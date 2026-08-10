// @vitest-environment node

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deriveEmailKey,
  resolveCloudUser,
} from "../../src/cloud-data/identity";
import { SqliteD1Database } from "./d1-test-adapter";

const migration = readFileSync("migrations/0001_cloud_data.sql", "utf8");
const secret = "preview-only-secret-with-at-least-32-bytes";
const now = 1_800_000_000_000;

let sqlite: DatabaseSync;
let database: SqliteD1Database;

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  sqlite
    .prepare(
      `INSERT INTO app_meta
        (singleton, environment, database_id, initialized_at)
       VALUES (1, 'production', 'production-database', ?)`,
    )
    .run(now);
  database = new SqliteD1Database(sqlite);
});

afterEach(() => sqlite.close());

async function enroll(email: string, enabled = true): Promise<string> {
  const emailKey = await deriveEmailKey(email, secret);
  sqlite
    .prepare(
      `INSERT INTO sync_enrollments (email_key, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(emailKey, enabled ? 1 : 0, now, now);
  return emailKey;
}

async function resolve(
  accessSub = "access-user-1",
  email = "Player@Example.COM",
) {
  return resolveCloudUser(
    database,
    { accessSub, email },
    {
      emailKeySecret: secret,
      now,
      createUserId: () => "user-created-1",
    },
  );
}

describe("email enrollment keys", () => {
  it("uses a deterministic, secret-bound key without retaining the email", async () => {
    const first = await deriveEmailKey("Player@Example.COM", secret);
    const second = await deriveEmailKey("Player@example.com", secret);
    const otherSecret = await deriveEmailKey(
      "Player@example.com",
      "a-different-secret-with-at-least-32-bytes",
    );

    expect(first).toBe(second);
    expect(first).toMatch(/^v1_[A-Za-z0-9_-]{43}$/);
    expect(first).not.toContain("Player");
    expect(otherSecret).not.toBe(first);
  });

  it("rejects a weak server secret", async () => {
    await expect(
      deriveEmailKey("player@example.com", "too-short"),
    ).rejects.toThrow("EMAIL_KEY_SECRET_INVALID");
  });
});

describe("cloud user resolution", () => {
  it("creates one account only for an enabled enrollment", async () => {
    const emailKey = await enroll("Player@example.com");

    await expect(resolve()).resolves.toEqual({
      id: "user-created-1",
      accessSub: "access-user-1",
      email: "Player@example.com",
      emailKey,
    });
    expect(
      sqlite
        .prepare(
          `SELECT id, email_key, email, access_sub, status, created_at, last_seen_at
           FROM users`,
        )
        .all(),
    ).toEqual([
      {
        id: "user-created-1",
        email_key: emailKey,
        email: "Player@example.com",
        access_sub: "access-user-1",
        status: "active",
        created_at: now,
        last_seen_at: now,
      },
    ]);
  });

  it("rejects an email that is absent or disabled without creating data", async () => {
    await expect(resolve()).rejects.toThrow("SYNC_NOT_ENROLLED");
    await enroll("Player@example.com", false);
    await expect(resolve()).rejects.toThrow("SYNC_NOT_ENROLLED");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual(
      { count: 0 },
    );
  });

  it("reuses the same account and writes last-seen at most once per day", async () => {
    await enroll("Player@example.com");
    await resolve();

    const resolved = await resolveCloudUser(
      database,
      { accessSub: "access-user-1", email: "Player@Example.COM" },
      {
        emailKeySecret: secret,
        now: now + 500,
        createUserId: () => "must-not-be-used",
      },
    );

    expect(resolved.id).toBe("user-created-1");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual(
      { count: 1 },
    );
    expect(sqlite.prepare("SELECT last_seen_at FROM users").get()).toEqual({
      last_seen_at: now,
    });

    await resolveCloudUser(
      database,
      { accessSub: "access-user-1", email: "Player@example.com" },
      {
        emailKeySecret: secret,
        now: now + 24 * 60 * 60 * 1_000,
        createUserId: () => "must-not-be-used",
      },
    );
    expect(sqlite.prepare("SELECT last_seen_at FROM users").get()).toEqual({
      last_seen_at: now + 24 * 60 * 60 * 1_000,
    });
  });

  it("does not let an existing Access subject switch to another enrolled email", async () => {
    await enroll("Player@example.com");
    await enroll("attacker@example.com");
    await resolve();

    await expect(
      resolve("access-user-1", "attacker@example.com"),
    ).rejects.toThrow("IDENTITY_CONFLICT");
    expect(
      sqlite
        .prepare("SELECT email FROM users WHERE id = ?")
        .get("user-created-1"),
    ).toEqual({ email: "Player@example.com" });
  });

  it("requires an explicit relink when the verified subject changes", async () => {
    await enroll("Player@example.com");
    await resolve();

    await expect(resolve("replacement-sub")).rejects.toThrow(
      "IDENTITY_RELINK_REQUIRED",
    );
    expect(
      sqlite
        .prepare("SELECT access_sub FROM users WHERE id = ?")
        .get("user-created-1"),
    ).toEqual({ access_sub: "access-user-1" });
  });

  it("keeps a deleted identity permanently closed", async () => {
    await enroll("Player@example.com");
    await resolve();
    sqlite
      .prepare(
        `UPDATE users
         SET email = NULL, access_sub = NULL, status = 'deleted', deleted_at = ?
         WHERE id = ?`,
      )
      .run(now + 1, "user-created-1");

    await expect(resolve()).rejects.toThrow("ACCOUNT_DELETED");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual(
      { count: 1 },
    );
  });
});
