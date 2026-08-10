// @vitest-environment node

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
} from "../../src/cloud-data/idempotency";
import { SqliteD1Database } from "./d1-test-adapter";

const migration = readFileSync("migrations/0001_cloud_data.sql", "utf8");
const now = 1_800_000_000_000;

let sqlite: DatabaseSync;
let database: SqliteD1Database;

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  for (const suffix of ["one", "two"]) {
    sqlite
      .prepare(
        `INSERT INTO users
          (id, email_key, email, access_sub, status, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      )
      .run(
        `user-${suffix}`,
        `key-${suffix}`,
        `${suffix}@example.com`,
        `sub-${suffix}`,
        now,
        now,
      );
  }
  database = new SqliteD1Database(sqlite);
});

afterEach(() => sqlite.close());

function claim(
  overrides: Partial<Parameters<typeof claimIdempotencyKey>[1]> = {},
) {
  return claimIdempotencyKey(database, {
    userId: "user-one",
    key: "idempotency-key-0001",
    operation: "deck.put",
    requestHash: "a".repeat(64),
    now,
    leaseToken: "lease-token-0001",
    ...overrides,
  });
}

describe("idempotency leases", () => {
  it("claims once, completes once, and replays the stored response", async () => {
    const first = await claim();
    expect(first).toEqual({
      kind: "execute",
      leaseToken: "lease-token-0001",
    });
    if (first.kind !== "execute") throw new Error("CLAIM_EXPECTED");

    await completeIdempotencyKey(database, first, {
      userId: "user-one",
      key: "idempotency-key-0001",
      status: 201,
      body: { data: { revision: 1 } },
    });

    await expect(claim()).resolves.toEqual({
      kind: "replay",
      status: 201,
      body: { data: { revision: 1 } },
    });
  });

  it("rejects reuse for another operation or payload", async () => {
    await claim();

    await expect(
      claim({ operation: "match.post" }),
    ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
    await expect(
      claim({ requestHash: "b".repeat(64) }),
    ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
  });

  it("blocks a concurrent request and permits takeover after lease expiry", async () => {
    await claim();

    await expect(
      claim({ leaseToken: "lease-token-0002", now: now + 1 }),
    ).resolves.toMatchObject({ kind: "pending", retryAfterSeconds: 30 });
    await expect(
      claim({ leaseToken: "lease-token-0003", now: now + 30_000 }),
    ).resolves.toEqual({
      kind: "execute",
      leaseToken: "lease-token-0003",
    });
  });

  it("scopes the same key to separate authenticated users", async () => {
    await claim();
    await expect(
      claim({ userId: "user-two", leaseToken: "lease-token-user-two" }),
    ).resolves.toMatchObject({ kind: "execute" });
  });
});
