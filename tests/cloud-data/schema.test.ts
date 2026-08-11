import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "migrations/0001_cloud_data.sql");

let db: DatabaseSync;

function insertUser(
  id: string,
  emailKey: string,
  email: string,
  accessSub: string,
): void {
  db.prepare(
    `INSERT INTO users
      (id, email_key, email, access_sub, status, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, 'active', 1, 1)`,
  ).run(id, emailKey, email, accessSub);
}

function insertDeck(userId: string, deckId: string): void {
  db.prepare(
    `INSERT INTO decks
      (user_id, deck_id, name, partner_card_num, case_card_num, cards_json,
       revision, client_modified_at, server_updated_at)
     VALUES (?, ?, 'Deck', 'D08001', 'D08026', '[]', 1, 1, 1)`,
  ).run(userId, deckId);
}

function insertMatch(userId: string, matchId: string): void {
  db.prepare(
    `INSERT INTO matches
      (user_id, match_id, played_at, expires_at, first_ingested_at, deck_id, deck_revision,
       deck_name_snapshot, cpu_requested_difficulty, cpu_effective_difficulty,
       cpu_policy_version, outcome, turn_count, app_version, request_hash)
     VALUES (?, ?, 100, 2592000100, 100, 'deck-1', 1, 'Deck', 'normal', 'normal',
             'cpu-v1', 'win', 7, '1.0.0+abc', 'hash-1')`,
  ).run(userId, matchId);
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA recursive_triggers = OFF");
  db.exec(readFileSync(migrationPath, "utf8"));
  db.prepare(
    `INSERT INTO app_meta
      (singleton, environment, database_id, initialized_at)
     VALUES (1, 'production', 'production-database', 1)`,
  ).run();
  insertUser("user-1", "email-key-1", "one@example.com", "sub-1");
  insertUser("user-2", "email-key-2", "two@example.com", "sub-2");
});

afterEach(() => db.close());

describe("cloud data ownership schema", () => {
  it("caps enabled sync enrollments at the fixed twelve-person audience", () => {
    const insert = db.prepare(
      `INSERT INTO sync_enrollments (email_key, enabled, created_at, updated_at)
       VALUES (?, ?, 1, 1)`,
    );

    for (let index = 0; index < 12; index += 1) {
      insert.run(`enabled-${index}`, 1);
    }

    expect(() => insert.run("enabled-overflow", 1)).toThrow(
      "ENROLLMENT_LIMIT_REACHED",
    );

    insert.run("disabled-overflow", 0);
    expect(() =>
      db
        .prepare(
          `UPDATE sync_enrollments SET enabled = 1, updated_at = 2
           WHERE email_key = 'disabled-overflow'`,
        )
        .run(),
    ).toThrow("ENROLLMENT_LIMIT_REACHED");
  });

  it("limits preview enrollment to one verification account", () => {
    db.close();
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(readFileSync(migrationPath, "utf8"));
    db.prepare(
      `INSERT INTO app_meta
        (singleton, environment, database_id, initialized_at)
       VALUES (1, 'preview', 'preview-database', 1)`,
    ).run();
    const insert = db.prepare(
      `INSERT INTO sync_enrollments (email_key, enabled, created_at, updated_at)
       VALUES (?, 1, 1, 1)`,
    );

    insert.run("preview-owner");
    expect(() => insert.run("preview-second-user")).toThrow(
      "ENROLLMENT_LIMIT_REACHED",
    );
  });

  it("allows the same client deck id for different owners", () => {
    insertDeck("user-1", "shared-client-id");
    insertDeck("user-2", "shared-client-id");

    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM decks WHERE deck_id = 'shared-client-id'",
        )
        .get(),
    ).toEqual({ count: 2 });
  });

  it("round-trips every required deck field and rejects non-array card JSON", () => {
    const cards = JSON.stringify([
      { cardNum: "D08005", count: 3 },
      { cardNum: "D08006", count: 37 },
    ]);
    db.prepare(
      `INSERT INTO decks
        (user_id, deck_id, name, partner_card_num, case_card_num, cards_json,
         revision, client_modified_at, server_updated_at)
       VALUES ('user-1', 'complete', 'Complete', 'D08001', 'D08026', ?, 2, 10, 20)`,
    ).run(cards);

    expect(
      db
        .prepare(
          `SELECT deck_id, name, partner_card_num, case_card_num, cards_json,
                revision, client_modified_at, server_updated_at
         FROM decks WHERE user_id = 'user-1' AND deck_id = 'complete'`,
        )
        .get(),
    ).toEqual({
      deck_id: "complete",
      name: "Complete",
      partner_card_num: "D08001",
      case_card_num: "D08026",
      cards_json: cards,
      revision: 2,
      client_modified_at: 10,
      server_updated_at: 20,
    });

    expect(() =>
      db
        .prepare(
          `INSERT INTO decks
          (user_id, deck_id, name, partner_card_num, case_card_num, cards_json,
           revision, client_modified_at, server_updated_at)
         VALUES ('user-1', 'bad-json', 'Bad', 'D08001', 'D08026', '{}', 1, 1, 1)`,
        )
        .run(),
    ).toThrow("CHECK constraint failed");
  });

  it("prevents a deleted deck from being recreated for the same cloud account", () => {
    insertDeck("user-1", "deleted-deck");
    db.prepare(
      `INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
       VALUES ('user-1', 'deleted-deck', 10)`,
    ).run();

    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM decks
         WHERE user_id = 'user-1' AND deck_id = 'deleted-deck'`,
        )
        .get(),
    ).toEqual({ count: 0 });

    expect(() =>
      db
        .prepare(
          `INSERT INTO decks
          (user_id, deck_id, name, partner_card_num, case_card_num, cards_json,
           revision, client_modified_at, server_updated_at)
         VALUES ('user-1', 'deleted-deck', 'Old', 'D08001', 'D08026', '[]', 1, 1, 1)`,
        )
        .run(),
    ).toThrow("DECK_TOMBSTONED");

    expect(() =>
      db
        .prepare(
          `INSERT INTO decks
          (user_id, deck_id, name, partner_card_num, case_card_num, cards_json,
           revision, client_modified_at, server_updated_at)
         VALUES ('user-2', 'deleted-deck', 'Other owner', 'D08001', 'D08026', '[]', 1, 1, 1)`,
        )
        .run(),
    ).not.toThrow();

    expect(() =>
      db
        .prepare(
          `UPDATE deck_tombstones SET deck_id = 'moved-tombstone'
         WHERE user_id = 'user-1' AND deck_id = 'deleted-deck'`,
        )
        .run(),
    ).toThrow("DECK_TOMBSTONE_IMMUTABLE");
    expect(() =>
      db
        .prepare(
          `DELETE FROM deck_tombstones
         WHERE user_id = 'user-1' AND deck_id = 'deleted-deck'`,
        )
        .run(),
    ).toThrow("DECK_TOMBSTONE_IMMUTABLE");
    expect(() =>
      db
        .prepare(
          `INSERT INTO decks
          (user_id, deck_id, name, partner_card_num, case_card_num, cards_json,
           revision, client_modified_at, server_updated_at)
         VALUES ('user-1', 'deleted-deck', 'Still old', 'D08001', 'D08026', '[]', 1, 1, 1)`,
        )
        .run(),
    ).toThrow("DECK_TOMBSTONED");
  });

  it("requires an immutable tombstone before deleting a live deck", () => {
    insertDeck("user-1", "must-tombstone");
    expect(() =>
      db
        .prepare(
          `DELETE FROM decks
         WHERE user_id = 'user-1' AND deck_id = 'must-tombstone'`,
        )
        .run(),
    ).toThrow("DECK_DELETE_REQUIRES_TOMBSTONE");

    db.prepare(
      `INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
       VALUES ('user-1', 'must-tombstone', 10)`,
    ).run();
    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM decks
         WHERE user_id = 'user-1' AND deck_id = 'must-tombstone'`,
        )
        .get(),
    ).toEqual({ count: 0 });
  });

  it("rolls back a tombstone when deleting the live deck fails", () => {
    insertDeck("user-1", "rollback-deck");
    db.exec(
      `CREATE TRIGGER test_abort_deck_delete
       BEFORE DELETE ON decks
       BEGIN
         SELECT RAISE(ABORT, 'TEST_DECK_DELETE_FAILURE');
       END`,
    );

    expect(() =>
      db
        .prepare(
          `INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
         VALUES ('user-1', 'rollback-deck', 10)`,
        )
        .run(),
    ).toThrow("TEST_DECK_DELETE_FAILURE");
    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM decks
         WHERE user_id = 'user-1' AND deck_id = 'rollback-deck'`,
        )
        .get(),
    ).toEqual({ count: 1 });
    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM deck_tombstones
         WHERE user_id = 'user-1' AND deck_id = 'rollback-deck'`,
        )
        .get(),
    ).toEqual({ count: 0 });
  });

  it("scopes match idempotency to the owner", () => {
    insertMatch("user-1", "match-1");
    insertMatch("user-2", "match-1");
    expect(() => insertMatch("user-1", "match-1")).toThrow("MATCH_IMMUTABLE");
  });

  it("prevents match statistics from moving owners or bypassing the cap", () => {
    insertMatch("user-1", "match-1");

    expect(() =>
      db
        .prepare(
          `UPDATE user_match_stats SET user_id = 'user-2'
           WHERE user_id = 'user-1'`,
        )
        .run(),
    ).toThrow("OWNER_IMMUTABLE");
    expect(() =>
      db
        .prepare("DELETE FROM user_match_stats WHERE user_id = 'user-1'")
        .run(),
    ).toThrow("MATCH_STATS_IMMUTABLE");
    expect(
      db
        .prepare(
          `SELECT user_id, matches, wins, losses FROM user_match_stats
           WHERE user_id = 'user-1'`,
        )
        .get(),
    ).toEqual({ user_id: "user-1", matches: 1, wins: 1, losses: 0 });
  });

  it("atomically removes every owned row and enrollment on cloud deletion", () => {
    db.prepare(
      `INSERT INTO sync_enrollments (email_key, enabled, created_at, updated_at)
       VALUES ('email-key-1', 1, 1, 1)`,
    ).run();
    insertDeck("user-1", "deck-1");
    insertMatch("user-1", "match-1");
    db.prepare(
      `INSERT INTO user_preferences
        (user_id, active_deck_id, revision, server_updated_at)
       VALUES ('user-1', 'deck-1', 1, 1)`,
    ).run();
    db.prepare(
      `INSERT INTO idempotency_keys
        (user_id, idempotency_key, operation, request_hash, response_status,
         response_json, created_at, expires_at)
       VALUES ('user-1', 'idem', 'deck.put', 'hash', 200, '{}', 1, 2)`,
    ).run();
    db.prepare(
      `INSERT INTO rate_limit_buckets
        (user_id, route_class, bucket_start, request_count)
       VALUES ('user-1', 'write', 1, 1)`,
    ).run();
    db.prepare(
      `INSERT INTO deletion_challenges (user_id, token_hash, created_at, expires_at)
       VALUES ('user-1', 'token-hash', 1, 2)`,
    ).run();
    db.prepare(
      `INSERT INTO identity_relinks
        (id, user_id, old_access_sub_hash, new_access_sub_hash, confirmed_at)
       VALUES ('relink-1', 'user-1', 'old', 'new', 1)`,
    ).run();
    db.prepare(
      `INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
       VALUES ('user-1', 'already-deleted', 1)`,
    ).run();

    db.prepare(
      `UPDATE users
       SET email = NULL, access_sub = NULL, status = 'deleted', deleted_at = 20
       WHERE id = 'user-1'`,
    ).run();

    expect(
      db
        .prepare(
          `SELECT email_key, email, access_sub, status, deleted_at
         FROM users WHERE id = 'user-1'`,
        )
        .get(),
    ).toEqual({
      email_key: "email-key-1",
      email: null,
      access_sub: null,
      status: "deleted",
      deleted_at: 20,
    });

    for (const table of [
      "sync_enrollments",
      "decks",
      "deck_tombstones",
      "user_preferences",
      "matches",
      "user_match_stats",
      "idempotency_keys",
      "rate_limit_buckets",
      "deletion_challenges",
      "identity_relinks",
    ]) {
      const where =
        table === "sync_enrollments"
          ? "email_key = 'email-key-1'"
          : "user_id = 'user-1'";
      expect(
        db
          .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`)
          .get(),
      ).toEqual({
        count: 0,
      });
    }

    const rejectedChildWrites = [
      `INSERT INTO sync_enrollments (email_key, enabled, created_at, updated_at)
       VALUES ('email-key-1', 1, 2, 2)`,
      `INSERT INTO identity_relinks
        (id, user_id, old_access_sub_hash, new_access_sub_hash, confirmed_at)
       VALUES ('relink-2', 'user-1', 'old', 'new', 2)`,
      `INSERT INTO decks
        (user_id, deck_id, name, partner_card_num, case_card_num, cards_json,
         revision, client_modified_at, server_updated_at)
       VALUES ('user-1', 'new-deck', 'Deck', 'D08001', 'D08026', '[]', 1, 2, 2)`,
      `INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
       VALUES ('user-1', 'new-deck', 2)`,
      `INSERT INTO user_preferences
        (user_id, active_deck_id, revision, server_updated_at)
       VALUES ('user-1', NULL, 1, 2)`,
      `INSERT INTO matches
        (user_id, match_id, played_at, expires_at, first_ingested_at, deck_id,
         deck_revision, deck_name_snapshot, cpu_requested_difficulty,
         cpu_effective_difficulty, cpu_policy_version, outcome, turn_count,
         app_version, request_hash)
       VALUES ('user-1', 'new-match', 100, 2592000100, 100, 'deck-1', 1,
               'Deck', 'normal', 'normal', 'cpu-v1', 'win', 7, '1.0.0', 'hash')`,
      `INSERT INTO idempotency_keys
        (user_id, idempotency_key, operation, request_hash, response_status,
         response_json, created_at, expires_at)
       VALUES ('user-1', 'new-idem', 'deck.put', 'hash', 200, '{}', 1, 2)`,
      `INSERT INTO rate_limit_buckets
        (user_id, route_class, bucket_start, request_count)
       VALUES ('user-1', 'write', 2, 1)`,
      `INSERT INTO deletion_challenges (user_id, token_hash, created_at, expires_at)
       VALUES ('user-1', 'new-token', 1, 2)`,
    ];
    for (const sql of rejectedChildWrites) {
      expect(() => db.prepare(sql).run()).toThrow("ACCOUNT_DELETED");
    }
  });

  it("rolls back the account tombstone when child cleanup fails", () => {
    db.prepare(
      `INSERT INTO sync_enrollments (email_key, enabled, created_at, updated_at)
       VALUES ('email-key-1', 1, 1, 1)`,
    ).run();
    insertDeck("user-1", "deck-1");
    insertMatch("user-1", "match-1");
    db.exec(
      `CREATE TRIGGER test_abort_match_delete
       BEFORE DELETE ON matches
       BEGIN
         SELECT RAISE(ABORT, 'TEST_DELETE_FAILURE');
       END`,
    );

    expect(() =>
      db
        .prepare(
          `UPDATE users
         SET email = NULL, access_sub = NULL, status = 'deleted', deleted_at = 20
         WHERE id = 'user-1'`,
        )
        .run(),
    ).toThrow("TEST_DELETE_FAILURE");

    expect(
      db.prepare("SELECT status FROM users WHERE id = 'user-1'").get(),
    ).toEqual({
      status: "active",
    });
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM decks WHERE user_id = 'user-1'")
        .get(),
    ).toEqual({ count: 1 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM matches WHERE user_id = 'user-1'",
        )
        .get(),
    ).toEqual({ count: 1 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM sync_enrollments WHERE email_key = 'email-key-1'",
        )
        .get(),
    ).toEqual({ count: 1 });
  });

  it("keeps account tombstones and user identity keys terminal and immutable", () => {
    expect(() =>
      db
        .prepare(
          `UPDATE users SET email_key = 'changed-key' WHERE id = 'user-2'`,
        )
        .run(),
    ).toThrow("USER_IDENTITY_IMMUTABLE");

    db.prepare(
      `UPDATE users
       SET email = NULL, access_sub = NULL, status = 'deleted', deleted_at = 20
       WHERE id = 'user-1'`,
    ).run();
    expect(() =>
      db
        .prepare(
          `UPDATE users
         SET email = 'one@example.com', access_sub = 'sub-1', status = 'active', deleted_at = NULL
         WHERE id = 'user-1'`,
        )
        .run(),
    ).toThrow("ACCOUNT_DELETED");
    expect(() =>
      db.prepare("DELETE FROM users WHERE id = 'user-1'").run(),
    ).toThrow("ACCOUNT_TOMBSTONE_REQUIRED");
  });

  it("rejects UPDATE-based ownership transfer into a deleted account", () => {
    db.prepare(
      `UPDATE users
       SET email = NULL, access_sub = NULL, status = 'deleted', deleted_at = 20
       WHERE id = 'user-1'`,
    ).run();
    db.prepare(
      `INSERT INTO sync_enrollments (email_key, enabled, created_at, updated_at)
       VALUES ('email-key-2', 1, 1, 1)`,
    ).run();
    insertDeck("user-2", "owner-transfer");
    insertMatch("user-2", "owner-transfer");
    db.prepare(
      `INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
       VALUES ('user-2', 'owner-transfer-tombstone', 1)`,
    ).run();
    db.prepare(
      `INSERT INTO user_preferences
        (user_id, active_deck_id, revision, server_updated_at)
       VALUES ('user-2', 'owner-transfer', 1, 1)`,
    ).run();
    db.prepare(
      `INSERT INTO identity_relinks
        (id, user_id, old_access_sub_hash, new_access_sub_hash, confirmed_at)
       VALUES ('owner-transfer', 'user-2', 'old', 'new', 1)`,
    ).run();
    db.prepare(
      `INSERT INTO idempotency_keys
        (user_id, idempotency_key, operation, request_hash, response_status,
         response_json, created_at, expires_at)
       VALUES ('user-2', 'owner-transfer', 'deck.put', 'hash', 200, '{}', 1, 2)`,
    ).run();
    db.prepare(
      `INSERT INTO rate_limit_buckets
        (user_id, route_class, bucket_start, request_count)
       VALUES ('user-2', 'write', 1, 1)`,
    ).run();
    db.prepare(
      `INSERT INTO deletion_challenges (user_id, token_hash, created_at, expires_at)
       VALUES ('user-2', 'owner-transfer', 1, 2)`,
    ).run();

    const rejectedUpdates = [
      `UPDATE sync_enrollments SET email_key = 'email-key-1' WHERE email_key = 'email-key-2'`,
      `UPDATE identity_relinks SET user_id = 'user-1' WHERE id = 'owner-transfer'`,
      `UPDATE decks SET user_id = 'user-1' WHERE user_id = 'user-2' AND deck_id = 'owner-transfer'`,
      `UPDATE deck_tombstones SET user_id = 'user-1'
       WHERE user_id = 'user-2' AND deck_id = 'owner-transfer-tombstone'`,
      `UPDATE user_preferences SET user_id = 'user-1' WHERE user_id = 'user-2'`,
      `UPDATE matches SET user_id = 'user-1'
       WHERE user_id = 'user-2' AND match_id = 'owner-transfer'`,
      `UPDATE idempotency_keys SET user_id = 'user-1'
       WHERE user_id = 'user-2' AND idempotency_key = 'owner-transfer'`,
      `UPDATE rate_limit_buckets SET user_id = 'user-1'
       WHERE user_id = 'user-2' AND route_class = 'write'`,
      `UPDATE deletion_challenges SET user_id = 'user-1' WHERE user_id = 'user-2'`,
    ];
    for (const sql of rejectedUpdates) {
      expect(() => db.prepare(sql).run()).toThrow("IMMUTABLE");
    }
  });

  it("rejects INSERT OR REPLACE bypasses without deleting authoritative rows", () => {
    insertMatch("user-2", "must-survive");
    db.prepare(
      `INSERT INTO identity_relinks
        (id, user_id, old_access_sub_hash, new_access_sub_hash, confirmed_at)
       VALUES ('immutable-relink', 'user-1', 'old', 'new', 1)`,
    ).run();
    db.prepare(
      `INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
       VALUES ('user-1', 'immutable-tombstone', 10)`,
    ).run();
    db.prepare(
      `INSERT INTO idempotency_keys
        (user_id, idempotency_key, operation, request_hash, response_status,
         response_json, created_at, expires_at)
       VALUES ('user-2', 'immutable-idempotency', 'match.post', 'original',
               201, '{"saved":true}', 1, 2)`,
    ).run();

    expect(() =>
      db
        .prepare(
          `INSERT OR REPLACE INTO users
          (id, email_key, email, access_sub, status, created_at, last_seen_at)
         VALUES ('user-2', 'email-key-2', 'two@example.com', 'sub-2', 'active', 2, 2)`,
        )
        .run(),
    ).toThrow("USER_IDENTITY_IMMUTABLE");
    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM matches
         WHERE user_id = 'user-2' AND match_id = 'must-survive'`,
        )
        .get(),
    ).toEqual({ count: 1 });

    expect(() =>
      db
        .prepare(
          `INSERT OR REPLACE INTO users
          (id, email_key, email, access_sub, status, created_at, last_seen_at)
         VALUES ('user-3', 'email-key-2', 'three@example.com', 'sub-3', 'active', 2, 2)`,
        )
        .run(),
    ).toThrow("USER_IDENTITY_IMMUTABLE");
    expect(
      db.prepare("SELECT email FROM users WHERE id = 'user-2'").get(),
    ).toEqual({
      email: "two@example.com",
    });

    expect(() =>
      db
        .prepare(
          `INSERT OR REPLACE INTO matches
          (user_id, match_id, played_at, expires_at, first_ingested_at, deck_id,
           deck_revision, deck_name_snapshot, cpu_requested_difficulty,
           cpu_effective_difficulty, cpu_policy_version, outcome, turn_count,
           app_version, request_hash)
         VALUES ('user-2', 'must-survive', 100, 2592000100, 100, 'deck-1', 1,
                 'Deck', 'normal', 'normal', 'cpu-v1', 'loss', 7, '1.0.0', 'changed')`,
        )
        .run(),
    ).toThrow("MATCH_IMMUTABLE");
    expect(
      db
        .prepare(
          `SELECT outcome, request_hash FROM matches
         WHERE user_id = 'user-2' AND match_id = 'must-survive'`,
        )
        .get(),
    ).toEqual({ outcome: "win", request_hash: "hash-1" });

    expect(() =>
      db
        .prepare(
          `INSERT OR REPLACE INTO idempotency_keys
          (user_id, idempotency_key, operation, request_hash, response_status,
           response_json, created_at, expires_at)
         VALUES ('user-2', 'immutable-idempotency', 'match.post', 'changed',
                 200, '{"saved":false}', 1, 3)`,
        )
        .run(),
    ).toThrow("IDEMPOTENCY_RECORD_IMMUTABLE");
    expect(
      db
        .prepare(
          `SELECT request_hash, response_status FROM idempotency_keys
         WHERE user_id = 'user-2' AND idempotency_key = 'immutable-idempotency'`,
        )
        .get(),
    ).toEqual({ request_hash: "original", response_status: 201 });

    expect(() =>
      db
        .prepare(
          `INSERT OR REPLACE INTO identity_relinks
          (id, user_id, old_access_sub_hash, new_access_sub_hash, confirmed_at)
         VALUES ('immutable-relink', 'user-2', 'changed', 'changed', 2)`,
        )
        .run(),
    ).toThrow("IDENTITY_RELINK_IMMUTABLE");
    expect(
      db
        .prepare(
          `SELECT user_id, old_access_sub_hash, confirmed_at
         FROM identity_relinks WHERE id = 'immutable-relink'`,
        )
        .get(),
    ).toEqual({
      user_id: "user-1",
      old_access_sub_hash: "old",
      confirmed_at: 1,
    });
    expect(() =>
      db
        .prepare("DELETE FROM identity_relinks WHERE id = 'immutable-relink'")
        .run(),
    ).toThrow("IDENTITY_RELINK_IMMUTABLE");

    expect(() =>
      db
        .prepare(
          `INSERT OR REPLACE INTO deck_tombstones (user_id, deck_id, deleted_at)
         VALUES ('user-1', 'immutable-tombstone', 99)`,
        )
        .run(),
    ).toThrow("DECK_TOMBSTONE_IMMUTABLE");
    expect(
      db
        .prepare(
          `SELECT deleted_at FROM deck_tombstones
         WHERE user_id = 'user-1' AND deck_id = 'immutable-tombstone'`,
        )
        .get(),
    ).toEqual({ deleted_at: 10 });

    db.prepare(
      `UPDATE users
       SET email = NULL, access_sub = NULL, status = 'deleted', deleted_at = 20
       WHERE id = 'user-1'`,
    ).run();
    expect(() =>
      db
        .prepare(
          `INSERT OR REPLACE INTO users
          (id, email_key, email, access_sub, status, created_at, last_seen_at)
         VALUES ('user-1', 'email-key-1', 'one@example.com', 'sub-1', 'active', 3, 3)`,
        )
        .run(),
    ).toThrow("USER_IDENTITY_IMMUTABLE");
    expect(
      db.prepare("SELECT status FROM users WHERE id = 'user-1'").get(),
    ).toEqual({
      status: "deleted",
    });
  });

  it("rejects UPDATE OR REPLACE identity conflicts without deleting the other account", () => {
    insertMatch("user-2", "identity-must-survive");

    expect(() =>
      db
        .prepare(
          `UPDATE OR REPLACE users SET email = 'two@example.com'
         WHERE id = 'user-1'`,
        )
        .run(),
    ).toThrow("USER_IDENTITY_CONFLICT");
    expect(() =>
      db
        .prepare(
          `UPDATE OR REPLACE users SET access_sub = 'sub-2'
         WHERE id = 'user-1'`,
        )
        .run(),
    ).toThrow("USER_IDENTITY_CONFLICT");

    expect(
      db.prepare("SELECT id, email, access_sub FROM users ORDER BY id").all(),
    ).toEqual([
      { id: "user-1", email: "one@example.com", access_sub: "sub-1" },
      { id: "user-2", email: "two@example.com", access_sub: "sub-2" },
    ]);
    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM matches
         WHERE user_id = 'user-2' AND match_id = 'identity-must-survive'`,
        )
        .get(),
    ).toEqual({ count: 1 });

    expect(() =>
      db
        .prepare(
          `UPDATE users SET email = 'one-renamed@example.com', access_sub = 'sub-1-new'
         WHERE id = 'user-1'`,
        )
        .run(),
    ).not.toThrow();
  });

  it("rejects an active user without verified email or Access subject", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO users
          (id, email_key, email, access_sub, status, created_at, last_seen_at)
         VALUES ('invalid', 'invalid-key', NULL, NULL, 'active', 1, 1)`,
        )
        .run(),
    ).toThrow("CHECK constraint failed");
  });

  it("rejects matches without CPU authority and turns above the shared maximum", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO matches
          (user_id, match_id, played_at, expires_at, first_ingested_at, deck_id,
           deck_revision, deck_name_snapshot, cpu_requested_difficulty,
           cpu_effective_difficulty, cpu_policy_version, outcome, turn_count,
           app_version, request_hash)
         VALUES ('user-1', 'no-cpu', 100, 2592000100, 100, 'deck-1', 1, 'Deck',
                 NULL, NULL, 'cpu-v1', 'win', 7, '1.0.0', 'hash')`,
        )
        .run(),
    ).toThrow("NOT NULL constraint failed");

    expect(() =>
      db
        .prepare(
          `INSERT INTO matches
          (user_id, match_id, played_at, expires_at, first_ingested_at, deck_id,
           deck_revision, deck_name_snapshot, cpu_requested_difficulty,
           cpu_effective_difficulty, cpu_policy_version, outcome, turn_count,
           app_version, request_hash)
         VALUES ('user-1', 'too-long', 100, 2592000100, 100, 'deck-1', 1, 'Deck',
                 'normal', 'normal', 'cpu-v1', 'win', 1001, '1.0.0', 'hash')`,
        )
        .run(),
    ).toThrow("CHECK constraint failed");
  });

  it("requires every short-lived record to expire after creation", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO idempotency_keys
          (user_id, idempotency_key, operation, request_hash, response_status,
           response_json, created_at, expires_at)
         VALUES ('user-1', 'invalid-expiry', 'deck.put', 'hash', 200, '{}', 2, 2)`,
        )
        .run(),
    ).toThrow("CHECK constraint failed");
    expect(() =>
      db
        .prepare(
          `INSERT INTO deletion_challenges (user_id, token_hash, created_at, expires_at)
         VALUES ('user-1', 'invalid-expiry', 2, 1)`,
        )
        .run(),
    ).toThrow("CHECK constraint failed");
  });

  it("requires active deck ownership and clears it when the deck is tombstoned", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO user_preferences
          (user_id, active_deck_id, revision, server_updated_at)
         VALUES ('user-1', 'missing', 1, 1)`,
        )
        .run(),
    ).toThrow("ACTIVE_DECK_INVALID");

    insertDeck("user-1", "active-deck");
    db.prepare(
      `INSERT INTO user_preferences
        (user_id, active_deck_id, revision, server_updated_at)
       VALUES ('user-1', 'active-deck', 1, 1)`,
    ).run();
    db.prepare(
      `INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
       VALUES ('user-1', 'active-deck', 2)`,
    ).run();
    expect(
      db
        .prepare(
          "SELECT active_deck_id FROM user_preferences WHERE user_id = 'user-1'",
        )
        .get(),
    ).toEqual({ active_deck_id: null });
  });
});
