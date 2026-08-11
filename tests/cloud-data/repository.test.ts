// @vitest-environment node

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DeckInput, MatchInput } from "../../src/cloud-data/contracts";
import {
  appendMatch,
  CLOUD_DATA_LIMITS,
  deleteDeck,
  loadBootstrap,
  putDeck,
  setActiveDeck,
} from "../../src/cloud-data/repository";
import { MATCH_RETENTION_MS } from "../../src/cloud-data/retention";
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
        `email-key-${suffix}`,
        `${suffix}@example.com`,
        `sub-${suffix}`,
        now,
        now,
      );
  }
  database = new SqliteD1Database(sqlite);
});

afterEach(() => sqlite.close());

function deck(overrides: Partial<DeckInput> = {}): DeckInput {
  return {
    deckId: "deck-shared",
    name: "Blue Deck",
    partnerCardNum: "D08001",
    caseCardNum: "D08026",
    cards: [
      { cardNum: "D08005", count: 37 },
      { cardNum: "D08006", count: 3 },
    ],
    clientModifiedAt: now - 1_000,
    expectedRevision: null,
    ...overrides,
  };
}

function match(overrides: Partial<MatchInput> = {}): MatchInput {
  return {
    matchId: "match-1",
    playedAt: now - 5_000,
    deckId: "deck-shared",
    deckRevision: 1,
    deckName: "Blue Deck",
    cpuRequestedDifficulty: "normal",
    cpuEffectiveDifficulty: "normal",
    cpuPolicyVersion: "meta-cpu-v1",
    outcome: "win",
    turnCount: 8,
    appVersion: "1.0.0+test",
    ...overrides,
  };
}

describe("cloud data repository", () => {
  it("creates, updates, and semantically replays a deck", async () => {
    const created = await putDeck(database, "user-one", deck(), now);
    expect(created).toMatchObject({ replayed: false, deck: { revision: 1 } });

    const update = deck({
      name: "Updated Blue",
      expectedRevision: 1,
      clientModifiedAt: now + 1,
    });
    const updated = await putDeck(database, "user-one", update, now + 2);
    expect(updated).toMatchObject({
      replayed: false,
      deck: { name: "Updated Blue", revision: 2 },
    });

    await expect(
      putDeck(database, "user-one", update, now + 3),
    ).resolves.toMatchObject({ replayed: true, deck: { revision: 2 } });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM decks").get()).toEqual(
      { count: 1 },
    );
  });

  it("rejects stale changed writes without exposing another owner", async () => {
    await putDeck(database, "user-one", deck(), now);
    await putDeck(
      database,
      "user-one",
      deck({ name: "Current", expectedRevision: 1 }),
      now + 1,
    );

    await expect(
      putDeck(
        database,
        "user-one",
        deck({ name: "Stale attacker", expectedRevision: 1 }),
        now + 2,
      ),
    ).rejects.toThrow("DECK_REVISION_CONFLICT");
    await expect(
      deleteDeck(database, "user-two", "deck-shared", 2, now + 2),
    ).rejects.toThrow("DECK_NOT_FOUND");
  });

  it("classifies a changed concurrent create as a revision conflict", async () => {
    const results = await Promise.allSettled([
      putDeck(database, "user-one", deck({ name: "First" }), now),
      putDeck(database, "user-one", deck({ name: "Second" }), now),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ message: "DECK_REVISION_CONFLICT" }),
    });
  });

  it("allows the same client deck id for separate owners", async () => {
    await putDeck(database, "user-one", deck(), now);
    await putDeck(database, "user-two", deck({ name: "Other" }), now);

    const one = await loadBootstrap(database, "user-one", now);
    const two = await loadBootstrap(database, "user-two", now);
    expect(one.decks.map((item) => item.name)).toEqual(["Blue Deck"]);
    expect(two.decks.map((item) => item.name)).toEqual(["Other"]);
  });

  it("tombstones deletion and revisions an implicitly cleared active deck", async () => {
    await putDeck(database, "user-one", deck(), now);
    await setActiveDeck(database, "user-one", "deck-shared", null, now + 1);

    const deleted = await deleteDeck(
      database,
      "user-one",
      "deck-shared",
      1,
      now + 2,
    );
    expect(deleted).toEqual({
      deckId: "deck-shared",
      deletedAt: now + 2,
      replayed: false,
    });
    await expect(
      deleteDeck(database, "user-one", "deck-shared", 1, now + 3),
    ).resolves.toMatchObject({ replayed: true, deletedAt: now + 2 });

    const state = await loadBootstrap(database, "user-one", now + 2);
    expect(state.decks).toEqual([]);
    expect(state.deletedDecks).toEqual([
      { deckId: "deck-shared", deletedAt: now + 2 },
    ]);
    expect(state.activeDeck).toEqual({
      activeDeckId: null,
      revision: 2,
      serverUpdatedAt: now + 2,
    });
  });

  it("rejects the 501st tombstone without deleting the live active deck", async () => {
    await putDeck(database, "user-one", deck(), now);
    await setActiveDeck(database, "user-one", "deck-shared", null, now + 1);
    const insert = sqlite.prepare(
      `INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
       VALUES ('user-one', ?, ?)`,
    );
    for (let index = 0; index < CLOUD_DATA_LIMITS.tombstones; index += 1) {
      insert.run(`deleted-${index}`, now - index - 1);
    }

    await expect(
      deleteDeck(database, "user-one", "deck-shared", 1, now + 2),
    ).rejects.toThrow("TOMBSTONE_LIMIT_REACHED");
    expect(
      sqlite
        .prepare(
          `SELECT COUNT(*) AS count FROM decks
           WHERE user_id = 'user-one' AND deck_id = 'deck-shared'`,
        )
        .get(),
    ).toEqual({ count: 1 });
    expect(
      sqlite
        .prepare(
          `SELECT active_deck_id, revision FROM user_preferences
           WHERE user_id = 'user-one'`,
        )
        .get(),
    ).toEqual({ active_deck_id: "deck-shared", revision: 1 });
  });

  it("requires active-deck revisions and an owned live deck", async () => {
    await expect(
      setActiveDeck(database, "user-one", "missing", null, now),
    ).rejects.toThrow("ACTIVE_DECK_INVALID");
    await putDeck(database, "user-one", deck(), now);
    await setActiveDeck(database, "user-one", "deck-shared", null, now + 1);

    await expect(
      setActiveDeck(database, "user-one", null, null, now + 2),
    ).rejects.toThrow("ACTIVE_DECK_REVISION_CONFLICT");
    await expect(
      setActiveDeck(database, "user-one", "deck-shared", null, now + 2),
    ).resolves.toMatchObject({ replayed: true, activeDeck: { revision: 1 } });
  });

  it("stores one match per owner and rejects changed replay payloads", async () => {
    await expect(
      appendMatch(database, "user-one", match(), now),
    ).resolves.toEqual({ matchId: "match-1", replayed: false });
    await expect(
      appendMatch(database, "user-one", match(), now + 1),
    ).resolves.toEqual({ matchId: "match-1", replayed: true });
    await expect(
      appendMatch(database, "user-one", match({ outcome: "loss" }), now + 2),
    ).rejects.toThrow("MATCH_ID_CONFLICT");
    await expect(
      appendMatch(database, "user-two", match(), now + 2),
    ).resolves.toEqual({ matchId: "match-1", replayed: false });
  });

  it("does not create a stats row for a match on the expiry boundary", async () => {
    await expect(
      appendMatch(
        database,
        "user-one",
        match({ playedAt: now - MATCH_RETENTION_MS }),
        now,
      ),
    ).rejects.toThrow("MATCH_EXPIRED");

    expect(
      sqlite.prepare("SELECT COUNT(*) AS count FROM matches").get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare("SELECT COUNT(*) AS count FROM user_match_stats").get(),
    ).toEqual({ count: 0 });
  });

  it("bounds retained matches per owner before statistics can scan them", async () => {
    const insert = sqlite.prepare(
      `INSERT INTO matches
        (user_id, match_id, played_at, expires_at, first_ingested_at,
         deck_id, deck_revision, deck_name_snapshot,
         cpu_requested_difficulty, cpu_effective_difficulty,
         cpu_policy_version, outcome, turn_count, app_version, request_hash)
       VALUES ('user-one', ?, ?, ?, ?, 'deck-old', 1, 'Old',
               'normal', 'normal', 'meta-cpu-v1', 'win', 4, '1.0.0', ?)`,
    );
    sqlite.exec("BEGIN");
    for (let index = 0; index < CLOUD_DATA_LIMITS.matches; index += 1) {
      insert.run(
        `retained-${index}`,
        now - 1_000,
        now + MATCH_RETENTION_MS - 1_000,
        now,
        `hash-${index}`,
      );
    }
    sqlite.exec("COMMIT");

    await expect(
      appendMatch(database, "user-one", match({ matchId: "overflow" }), now),
    ).rejects.toThrow("MATCH_LIMIT_REACHED");
    await expect(
      loadBootstrap(database, "user-one", now),
    ).resolves.toMatchObject({
      stats: { matches: CLOUD_DATA_LIMITS.matches },
    });
    expect(
      sqlite
        .prepare(
          `SELECT matches, wins, losses FROM user_match_stats
           WHERE user_id = 'user-one'`,
        )
        .get(),
    ).toEqual({
      matches: CLOUD_DATA_LIMITS.matches,
      wins: CLOUD_DATA_LIMITS.matches,
      losses: 0,
    });
  });

  it("derives owner-only statistics from retained match rows", async () => {
    await appendMatch(database, "user-one", match(), now);
    await appendMatch(
      database,
      "user-one",
      match({ matchId: "match-2", outcome: "loss" }),
      now,
    );
    await appendMatch(database, "user-two", match(), now);
    const expiredPlayedAt = now - MATCH_RETENTION_MS - 1;
    sqlite
      .prepare(
        `INSERT INTO matches
          (user_id, match_id, played_at, expires_at, first_ingested_at,
           deck_id, deck_revision, deck_name_snapshot,
           cpu_requested_difficulty, cpu_effective_difficulty,
           cpu_policy_version, outcome, turn_count, app_version, request_hash)
         VALUES ('user-one', 'expired-match', ?, ?, ?, 'deck-old', 1, 'Old',
                 'normal', 'normal', 'meta-cpu-v1', 'win', 4, '1.0.0', 'old')`,
      )
      .run(
        expiredPlayedAt,
        expiredPlayedAt + MATCH_RETENTION_MS,
        expiredPlayedAt,
      );

    await expect(
      loadBootstrap(database, "user-one", now),
    ).resolves.toMatchObject({
      stats: { matches: 2, wins: 1, losses: 1 },
    });
    expect(
      sqlite
        .prepare(
          `SELECT matches, wins, losses FROM user_match_stats
           WHERE user_id = 'user-one'`,
        )
        .get(),
    ).toEqual({ matches: 2, wins: 1, losses: 1 });
    expect(
      sqlite
        .prepare(
          `SELECT COUNT(*) AS count FROM matches
           WHERE user_id = 'user-one' AND match_id = 'expired-match'`,
        )
        .get(),
    ).toEqual({ count: 0 });
  });

  it("opportunistically removes a bounded batch of expired rows", async () => {
    const expiredPlayedAt = now - MATCH_RETENTION_MS - 1;
    sqlite
      .prepare(
        `INSERT INTO matches
          (user_id, match_id, played_at, expires_at, first_ingested_at,
           deck_id, deck_revision, deck_name_snapshot,
           cpu_requested_difficulty, cpu_effective_difficulty,
           cpu_policy_version, outcome, turn_count, app_version, request_hash)
         VALUES ('user-one', 'expired-before-write', ?, ?, ?, 'deck-old', 1,
                 'Old', 'normal', 'normal', 'meta-cpu-v1', 'win', 4,
                 '1.0.0', 'expired')`,
      )
      .run(
        expiredPlayedAt,
        expiredPlayedAt + MATCH_RETENTION_MS,
        expiredPlayedAt,
      );

    await appendMatch(database, "user-one", match(), now);
    expect(
      sqlite
        .prepare(
          `SELECT COUNT(*) AS count FROM matches
           WHERE match_id = 'expired-before-write'`,
        )
        .get(),
    ).toEqual({ count: 0 });
  });
});
