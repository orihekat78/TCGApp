// @vitest-environment node

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DAILY_RATE_LIMITS,
  RATE_LIMITS,
  consumeRateLimit,
} from "../../src/cloud-data/rate-limit";
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

describe("per-user rate limits", () => {
  it("atomically rejects requests beyond the route budget", async () => {
    const attempts = await Promise.all(
      Array.from({ length: RATE_LIMITS.match + 1 }, () =>
        consumeRateLimit(database, "user-one", "match", now),
      ),
    );

    expect(attempts.filter((attempt) => attempt.allowed)).toHaveLength(
      RATE_LIMITS.match,
    );
    expect(attempts.at(-1)).toEqual({
      allowed: false,
      limit: RATE_LIMITS.match,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    expect(
      sqlite
        .prepare(
          `SELECT request_count, minute_count FROM rate_limit_buckets
           WHERE user_id = 'user-one' AND route_class = 'match'
             AND bucket_start = ?`,
        )
        .get(Math.floor(now / (24 * 60 * 60 * 1_000)) * 24 * 60 * 60 * 1_000),
    ).toEqual({
      request_count: RATE_LIMITS.match,
      minute_count: RATE_LIMITS.match,
    });

    for (
      let index = 0;
      index < DAILY_RATE_LIMITS.match - RATE_LIMITS.match;
      index += 1
    ) {
      await expect(
        consumeRateLimit(database, "user-one", "match", now + 60_000),
      ).resolves.toMatchObject({ allowed: true });
    }
    expect(
      sqlite
        .prepare(
          `SELECT request_count FROM rate_limit_buckets
           WHERE user_id = 'user-one' AND route_class = 'match'`,
        )
        .get(),
    ).toEqual({ request_count: DAILY_RATE_LIMITS.match });
  });

  it("caps daily D1-metered requests without writing rejected attempts", async () => {
    for (let index = 0; index < DAILY_RATE_LIMITS.match; index += 1) {
      await expect(
        consumeRateLimit(database, "user-one", "match", now + index * 60_000),
      ).resolves.toMatchObject({ allowed: true });
    }

    await expect(
      consumeRateLimit(
        database,
        "user-one",
        "match",
        now + DAILY_RATE_LIMITS.match * 60_000,
      ),
    ).resolves.toMatchObject({
      allowed: false,
      limit: DAILY_RATE_LIMITS.match,
      remaining: 0,
    });
    expect(
      sqlite
        .prepare(
          `SELECT request_count FROM rate_limit_buckets
           WHERE user_id = 'user-one' AND route_class = 'match'`,
        )
        .get(),
    ).toEqual({ request_count: DAILY_RATE_LIMITS.match });
    expect(
      sqlite
        .prepare(
          `SELECT COUNT(*) AS count FROM rate_limit_buckets
           WHERE user_id = 'user-one' AND route_class = 'match'`,
        )
        .get(),
    ).toEqual({ count: 1 });
  });

  it("isolates users and starts a new fixed minute bucket", async () => {
    for (let index = 0; index < RATE_LIMITS.match; index += 1) {
      await consumeRateLimit(database, "user-one", "match", now);
    }

    await expect(
      consumeRateLimit(database, "user-two", "match", now),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      consumeRateLimit(database, "user-one", "match", now + 60_000),
    ).resolves.toMatchObject({
      allowed: true,
      remaining: RATE_LIMITS.match - 1,
    });
  });

  it("bounds cleanup of minute buckets older than one day", async () => {
    const oldStart = now - 2 * 24 * 60 * 60 * 1_000;
    const insert = sqlite.prepare(
      `INSERT INTO rate_limit_buckets
        (user_id, route_class, bucket_start, request_count)
       VALUES ('user-two', 'read', ?, 1)`,
    );
    for (let index = 0; index < 101; index += 1) {
      insert.run(oldStart + index * 60_000);
    }

    await consumeRateLimit(database, "user-one", "match", now);
    expect(
      sqlite
        .prepare(
          `SELECT COUNT(*) AS count FROM rate_limit_buckets
           WHERE bucket_start < ?`,
        )
        .get(now - 24 * 60 * 60 * 1_000),
    ).toEqual({ count: 91 });

    await consumeRateLimit(database, "user-two", "match", now);
    expect(
      sqlite
        .prepare(
          `SELECT COUNT(*) AS count FROM rate_limit_buckets
           WHERE bucket_start < ?`,
        )
        .get(now - 24 * 60 * 60 * 1_000),
    ).toEqual({ count: 81 });
  });
});
