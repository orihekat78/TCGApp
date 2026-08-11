import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MATCH_RETENTION_MS,
  createRetentionCleanupStatements,
} from "../../src/cloud-data/retention";

const migrationPath = resolve(process.cwd(), "migrations/0001_cloud_data.sql");
let db: DatabaseSync;

function insertMatch(matchId: string, playedAt: number): void {
  db.prepare(
    `INSERT INTO matches
      (user_id, match_id, played_at, expires_at, first_ingested_at, deck_id,
       deck_revision, deck_name_snapshot, cpu_requested_difficulty,
       cpu_effective_difficulty, cpu_policy_version, outcome, turn_count,
       app_version, request_hash)
     VALUES ('user-1', ?, ?, ?, ?, 'deck-1', 1, 'Deck', 'normal', 'normal',
             'cpu-v1', 'win', 7, '1.0.0', 'hash')`,
  ).run(matchId, playedAt, playedAt + MATCH_RETENTION_MS, playedAt);
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readFileSync(migrationPath, "utf8"));
  db.prepare(
    `INSERT INTO users
      (id, email_key, email, access_sub, status, created_at, last_seen_at)
     VALUES ('user-1', 'email-key-1', 'one@example.com', 'sub-1', 'active', 1, 1)`,
  ).run();
});

afterEach(() => db.close());

describe("bounded cloud retention cleanup", () => {
  it("deletes expired rows at the boundary and retains future rows", () => {
    const now = MATCH_RETENTION_MS + 1_000;
    insertMatch("expired", 1_000);
    insertMatch("future", 1_001);
    db.prepare(
      `INSERT INTO idempotency_keys
        (user_id, idempotency_key, operation, request_hash, response_status,
         response_json, created_at, expires_at)
       VALUES ('user-1', 'expired', 'deck.put', 'hash', 200, '{}', 1, ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO idempotency_keys
        (user_id, idempotency_key, operation, request_hash, response_status,
         response_json, created_at, expires_at)
       VALUES ('user-1', 'future', 'deck.put', 'hash', 200, '{}', 1, ?)`,
    ).run(now + 1);
    db.prepare(
      `INSERT INTO deletion_challenges
        (user_id, token_hash, created_at, expires_at)
       VALUES ('user-1', 'expired', 1, ?)`,
    ).run(now);

    for (const statement of createRetentionCleanupStatements(now, 100)) {
      db.prepare(statement.sql).run(...statement.bindings);
    }

    expect(db.prepare("SELECT match_id FROM matches").all()).toEqual([
      { match_id: "future" },
    ]);
    expect(
      db.prepare("SELECT idempotency_key FROM idempotency_keys").all(),
    ).toEqual([{ idempotency_key: "future" }]);
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM deletion_challenges").get(),
    ).toEqual({
      count: 0,
    });
  });

  it("limits each table deletion batch and removes oldest expiries first", () => {
    for (const [key, expiresAt] of [
      ["oldest", 2],
      ["middle", 3],
      ["newest", 4],
    ] as const) {
      db.prepare(
        `INSERT INTO idempotency_keys
          (user_id, idempotency_key, operation, request_hash, response_status,
           response_json, created_at, expires_at)
         VALUES ('user-1', ?, 'deck.put', 'hash', 200, '{}', 1, ?)`,
      ).run(key, expiresAt);
    }

    const statement = createRetentionCleanupStatements(10, 2).find(
      ({ table }) => table === "idempotency_keys",
    );
    if (!statement) throw new Error("IDEMPOTENCY_CLEANUP_MISSING");
    db.prepare(statement.sql).run(...statement.bindings);

    expect(
      db.prepare("SELECT idempotency_key FROM idempotency_keys").all(),
    ).toEqual([{ idempotency_key: "newest" }]);
  });

  it("limits opportunistic match-trigger cleanup to two rows per table", () => {
    for (const [key, expiresAt] of [
      ["oldest", 2],
      ["middle", 3],
      ["newest", 4],
    ] as const) {
      db.prepare(
        `INSERT INTO idempotency_keys
          (user_id, idempotency_key, operation, request_hash, response_status,
           response_json, created_at, expires_at)
         VALUES ('user-1', ?, 'deck.put', 'hash', 200, '{}', 1, ?)`,
      ).run(key, expiresAt);
    }

    insertMatch("cleanup-trigger", 100);

    expect(
      db.prepare("SELECT idempotency_key FROM idempotency_keys").all(),
    ).toEqual([{ idempotency_key: "newest" }]);
  });

  it("rejects an unbounded or invalid cleanup request", () => {
    expect(() => createRetentionCleanupStatements(10, 0)).toThrow(
      "RETENTION_BATCH_INVALID",
    );
    expect(() => createRetentionCleanupStatements(10, 1_001)).toThrow(
      "RETENTION_BATCH_INVALID",
    );
  });
});
