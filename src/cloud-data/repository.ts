import type { DeckInput, MatchInput } from "./contracts";
import { validateDeckInput, validateMatchInput } from "./contracts";
import type { D1DatabaseLike } from "./d1-types";
import { MATCH_RETENTION_MS } from "./retention";

const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;
export const CLOUD_DATA_LIMITS = {
  decks: 100,
  tombstones: 500,
  matches: 250,
} as const;
const MAX_DECKS = CLOUD_DATA_LIMITS.decks;
const MAX_STORED_DECK_ROWS = MAX_DECKS * 2;
const MAX_TOMBSTONES = CLOUD_DATA_LIMITS.tombstones;

export type CloudDeck = Omit<DeckInput, "expectedRevision"> & {
  revision: number;
  serverUpdatedAt: number;
};

export type ActiveDeckState = {
  activeDeckId: string | null;
  revision: number;
  serverUpdatedAt: number;
};

export type CloudBootstrap = {
  decks: CloudDeck[];
  deletedDecks: Array<{ deckId: string; deletedAt: number }>;
  activeDeck: ActiveDeckState | null;
  stats: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number | null;
  };
};

type DeckRow = {
  deck_id: string;
  name: string;
  partner_card_num: string;
  case_card_num: string;
  cards_json: string;
  revision: number;
  client_modified_at: number;
  server_updated_at: number;
};

type TombstoneRow = { deck_id: string; deleted_at: number };

type ActiveDeckRow = {
  active_deck_id: string | null;
  revision: number;
  server_updated_at: number;
};

type MatchHashRow = { request_hash: string };

type StatsRow = { matches: number; wins: number; losses: number };

function requireResourceId(value: string, code: string): void {
  if (!RESOURCE_ID.test(value)) throw new Error(code);
}

function requireNow(now: number): void {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("REQUEST_TIME_INVALID");
  }
}

function errorHasCode(error: unknown, code: string): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    if (current.message.includes(code)) return true;
    current = current.cause;
  }
  return false;
}

function canonicalCards(input: DeckInput): string {
  return JSON.stringify(
    [...input.cards].sort((left, right) =>
      left.cardNum.localeCompare(right.cardNum),
    ),
  );
}

function parseDeck(row: DeckRow): CloudDeck {
  let cards: unknown;
  try {
    cards = JSON.parse(row.cards_json);
  } catch {
    throw new Error("DECK_STORAGE_INVALID");
  }
  if (!Array.isArray(cards)) throw new Error("DECK_STORAGE_INVALID");
  let validated: DeckInput;
  try {
    validated = validateDeckInput({
      deckId: row.deck_id,
      name: row.name,
      partnerCardNum: row.partner_card_num,
      caseCardNum: row.case_card_num,
      cards,
      clientModifiedAt: row.client_modified_at,
      expectedRevision: null,
    });
  } catch (error) {
    throw new Error("DECK_STORAGE_INVALID", { cause: error });
  }
  if (
    !Number.isSafeInteger(row.revision) || row.revision < 1
    || !Number.isSafeInteger(row.server_updated_at) || row.server_updated_at < 0
  ) throw new Error("DECK_STORAGE_INVALID");
  return {
    deckId: validated.deckId,
    name: validated.name,
    partnerCardNum: validated.partnerCardNum,
    caseCardNum: validated.caseCardNum,
    cards: validated.cards,
    clientModifiedAt: validated.clientModifiedAt,
    revision: row.revision,
    serverUpdatedAt: row.server_updated_at,
  };
}

function parseBootstrapDeck(row: DeckRow): CloudDeck | null {
  try {
    return parseDeck(row);
  } catch (error) {
    if (error instanceof Error && error.message === "DECK_STORAGE_INVALID") {
      return null;
    }
    throw error;
  }
}

type DeckQuotaSnapshot = {
  rows: DeckRow[];
  legalDecks: CloudDeck[];
  quarantinedRows: DeckRow[];
};

async function loadDeckQuotaSnapshot(
  database: D1DatabaseLike,
  userId: string,
): Promise<DeckQuotaSnapshot> {
  const result = await database
    .prepare(
      `SELECT deck_id, name, partner_card_num, case_card_num, cards_json,
              revision, client_modified_at, server_updated_at
       FROM decks
       WHERE user_id = ?
       ORDER BY server_updated_at, deck_id
       LIMIT ?`,
    )
    .bind(userId, MAX_STORED_DECK_ROWS + 1)
    .all<DeckRow>();
  const rows = result.results ?? [];
  const legalDecks: CloudDeck[] = [];
  const quarantinedRows: DeckRow[] = [];
  for (const row of rows) {
    const parsed = parseBootstrapDeck(row);
    if (parsed) legalDecks.push(parsed);
    else quarantinedRows.push(row);
  }
  return { rows, legalDecks, quarantinedRows };
}

function quarantineFingerprintJson(rows: readonly DeckRow[]): string {
  return JSON.stringify(rows.map((row) => ({
    deckId: row.deck_id,
    revision: row.revision,
    serverUpdatedAt: row.server_updated_at,
  })));
}

function sameDeck(row: DeckRow, input: DeckInput, cardsJson: string): boolean {
  return (
    row.name === input.name &&
    row.partner_card_num === input.partnerCardNum &&
    row.case_card_num === input.caseCardNum &&
    row.cards_json === cardsJson &&
    row.client_modified_at === input.clientModifiedAt
  );
}

async function findDeck(
  database: D1DatabaseLike,
  userId: string,
  deckId: string,
): Promise<DeckRow | null> {
  return database
    .prepare(
      `SELECT deck_id, name, partner_card_num, case_card_num, cards_json,
              revision, client_modified_at, server_updated_at
       FROM decks
       WHERE user_id = ? AND deck_id = ?
       LIMIT 1`,
    )
    .bind(userId, deckId)
    .first<DeckRow>();
}

async function findTombstone(
  database: D1DatabaseLike,
  userId: string,
  deckId: string,
): Promise<TombstoneRow | null> {
  return database
    .prepare(
      `SELECT deck_id, deleted_at
       FROM deck_tombstones
       WHERE user_id = ? AND deck_id = ?
       LIMIT 1`,
    )
    .bind(userId, deckId)
    .first<TombstoneRow>();
}

async function findActiveDeck(
  database: D1DatabaseLike,
  userId: string,
): Promise<ActiveDeckRow | null> {
  return database
    .prepare(
      `SELECT active_deck_id, revision, server_updated_at
       FROM user_preferences
       WHERE user_id = ?
       LIMIT 1`,
    )
    .bind(userId)
    .first<ActiveDeckRow>();
}

async function cleanupExpiredMatches(
  database: D1DatabaseLike,
  userId: string,
  now: number,
): Promise<void> {
  await database
    .prepare(
      `DELETE FROM matches
       WHERE rowid IN (
         SELECT rowid FROM matches
         WHERE user_id = ? AND expires_at <= ?
         ORDER BY expires_at, rowid
         LIMIT ?
       )`,
    )
    .bind(userId, now, CLOUD_DATA_LIMITS.matches)
    .run();
}

function mapActiveDeck(row: ActiveDeckRow): ActiveDeckState {
  return {
    activeDeckId: row.active_deck_id,
    revision: row.revision,
    serverUpdatedAt: row.server_updated_at,
  };
}

async function repairQuarantinedActiveDeck(
  database: D1DatabaseLike,
  userId: string,
  activeDeck: ActiveDeckRow | null,
  deckRows: readonly DeckRow[],
  now: number,
): Promise<{
  activeDeck: ActiveDeckRow | null;
  refreshedDeck: CloudDeck | null;
}> {
  // Invalid legacy deck rows stay recoverable in D1, but never cross the public
  // bootstrap boundary or remain selected as the user's active deck.
  let candidate = activeDeck;
  let candidateDeck = candidate?.active_deck_id
    ? deckRows.find((row) => row.deck_id === candidate?.active_deck_id) ?? null
    : null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!candidate || candidate.active_deck_id === null) {
      return { activeDeck: candidate, refreshedDeck: null };
    }
    const legalCandidate = candidateDeck ? parseBootstrapDeck(candidateDeck) : null;
    if (legalCandidate) {
      return { activeDeck: candidate, refreshedDeck: legalCandidate };
    }

    const deckGuard = candidateDeck
      ? `EXISTS (
           SELECT 1 FROM decks
           WHERE user_id = ? AND deck_id = ?
             AND name = ? AND partner_card_num = ? AND case_card_num = ?
             AND cards_json = ? AND revision = ?
             AND client_modified_at = ? AND server_updated_at = ?
         )`
      : `NOT EXISTS (
           SELECT 1 FROM decks WHERE user_id = ? AND deck_id = ?
         )`;
    const statement = database.prepare(
      `UPDATE user_preferences
       SET active_deck_id = NULL, revision = revision + 1, server_updated_at = ?
       WHERE user_id = ? AND revision = ? AND active_deck_id = ?
         AND ${deckGuard}`,
    );
    const result = await (candidateDeck
      ? statement.bind(
        now,
        userId,
        candidate.revision,
        candidate.active_deck_id,
        userId,
        candidateDeck.deck_id,
        candidateDeck.name,
        candidateDeck.partner_card_num,
        candidateDeck.case_card_num,
        candidateDeck.cards_json,
        candidateDeck.revision,
        candidateDeck.client_modified_at,
        candidateDeck.server_updated_at,
      )
      : statement.bind(
        now,
        userId,
        candidate.revision,
        candidate.active_deck_id,
        userId,
        candidate.active_deck_id,
      )).run();
    if (result.meta?.changes === 1) {
      return {
        activeDeck: {
          active_deck_id: null,
          revision: candidate.revision + 1,
          server_updated_at: now,
        },
        refreshedDeck: null,
      };
    }

    candidate = await findActiveDeck(database, userId);
    if (!candidate || candidate.active_deck_id === null) {
      return { activeDeck: candidate, refreshedDeck: null };
    }
    candidateDeck = await findDeck(database, userId, candidate.active_deck_id);
  }
  throw new Error("ACTIVE_DECK_REPAIR_CONFLICT");
}

export async function putDeck(
  database: D1DatabaseLike,
  userId: string,
  rawInput: DeckInput,
  now: number,
): Promise<{ deck: CloudDeck; replayed: boolean }> {
  requireResourceId(userId, "USER_ID_INVALID");
  requireNow(now);
  const input = validateDeckInput(rawInput);
  const cardsJson = canonicalCards(input);
  const tombstone = await findTombstone(database, userId, input.deckId);
  if (tombstone) throw new Error("DECK_TOMBSTONED");

  const current = await findDeck(database, userId, input.deckId);
  const currentIsLegal = current ? parseBootstrapDeck(current) !== null : false;
  if (current && currentIsLegal && sameDeck(current, input, cardsJson)) {
    return { deck: parseDeck(current), replayed: true };
  }
  if (!current && input.expectedRevision !== null) {
    throw new Error("DECK_NOT_FOUND");
  }
  if (current && input.expectedRevision !== current.revision) {
    throw new Error("DECK_REVISION_CONFLICT");
  }
  const quota = !current || !currentIsLegal
    ? await loadDeckQuotaSnapshot(database, userId)
    : null;
  if (quota && quota.rows.length > MAX_STORED_DECK_ROWS) {
    throw new Error("DECK_LIMIT_REACHED");
  }
  if (quota && quota.legalDecks.length >= MAX_DECKS) {
    throw new Error("DECK_LIMIT_REACHED");
  }
  const quarantined = quarantineFingerprintJson(quota?.quarantinedRows ?? []);

  try {
    if (!current) {
      const result = await database
        .prepare(
          `INSERT INTO decks
            (user_id, deck_id, name, partner_card_num, case_card_num, cards_json,
             revision, client_modified_at, server_updated_at)
           SELECT ?, ?, ?, ?, ?, ?, 1, ?, ?
           WHERE (
             SELECT COUNT(*) FROM decks AS stored
             WHERE stored.user_id = ?
               AND NOT EXISTS (
                 SELECT 1 FROM json_each(?) AS quarantined
                 WHERE json_extract(quarantined.value, '$.deckId') = stored.deck_id
                   AND json_extract(quarantined.value, '$.revision') = stored.revision
                   AND json_extract(quarantined.value, '$.serverUpdatedAt') = stored.server_updated_at
               )
           ) < ?
             AND (SELECT COUNT(*) FROM decks WHERE user_id = ?) < ?`,
        )
        .bind(
          userId,
          input.deckId,
          input.name,
          input.partnerCardNum,
          input.caseCardNum,
          cardsJson,
          input.clientModifiedAt,
          now,
          userId,
          quarantined,
          MAX_DECKS,
          userId,
          MAX_STORED_DECK_ROWS,
        )
        .run();
      if (result.meta?.changes === 0) throw new Error("DECK_LIMIT_REACHED");
    } else {
      const quotaClause = currentIsLegal
        ? ""
        : ` AND (
             SELECT COUNT(*) FROM decks AS stored
             WHERE stored.user_id = ? AND stored.deck_id != ?
               AND NOT EXISTS (
                 SELECT 1 FROM json_each(?) AS quarantined
                 WHERE json_extract(quarantined.value, '$.deckId') = stored.deck_id
                   AND json_extract(quarantined.value, '$.revision') = stored.revision
                   AND json_extract(quarantined.value, '$.serverUpdatedAt') = stored.server_updated_at
               )
           ) < ?`;
      const statement = database.prepare(
        `UPDATE decks
         SET name = ?, partner_card_num = ?, case_card_num = ?, cards_json = ?,
             revision = revision + 1, client_modified_at = ?, server_updated_at = ?
         WHERE user_id = ? AND deck_id = ? AND revision = ?${quotaClause}`,
      );
      const result = await (currentIsLegal
        ? statement.bind(
          input.name,
          input.partnerCardNum,
          input.caseCardNum,
          cardsJson,
          input.clientModifiedAt,
          now,
          userId,
          input.deckId,
          current.revision,
        )
        : statement.bind(
          input.name,
          input.partnerCardNum,
          input.caseCardNum,
          cardsJson,
          input.clientModifiedAt,
          now,
          userId,
          input.deckId,
          current.revision,
          userId,
          input.deckId,
          quarantined,
          MAX_DECKS,
        )).run();
      if (result.meta?.changes === 0) {
        throw new Error("DECK_REVISION_CONFLICT");
      }
    }
  } catch (error) {
    const racedTombstone = await findTombstone(database, userId, input.deckId);
    if (racedTombstone) {
      throw new Error("DECK_TOMBSTONED", { cause: error });
    }
    const raced = await findDeck(database, userId, input.deckId);
    if (raced && sameDeck(raced, input, cardsJson)) {
      return { deck: parseDeck(raced), replayed: true };
    }
    if (error instanceof Error && error.message === "DECK_LIMIT_REACHED") {
      throw error;
    }
    throw new Error(raced ? "DECK_REVISION_CONFLICT" : "DECK_WRITE_FAILED", {
      cause: error,
    });
  }

  const saved = await findDeck(database, userId, input.deckId);
  if (!saved) throw new Error("DECK_WRITE_FAILED");
  return { deck: parseDeck(saved), replayed: false };
}

export async function deleteDeck(
  database: D1DatabaseLike,
  userId: string,
  deckId: string,
  expectedRevision: number,
  now: number,
): Promise<{ deckId: string; deletedAt: number; replayed: boolean }> {
  requireResourceId(userId, "USER_ID_INVALID");
  requireResourceId(deckId, "DECK_ID_INVALID");
  requireNow(now);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw new Error("DECK_REVISION_INVALID");
  }

  const existingTombstone = await findTombstone(database, userId, deckId);
  if (existingTombstone) {
    return {
      deckId,
      deletedAt: existingTombstone.deleted_at,
      replayed: true,
    };
  }
  const current = await findDeck(database, userId, deckId);
  if (!current) throw new Error("DECK_NOT_FOUND");
  if (current.revision !== expectedRevision) {
    throw new Error("DECK_REVISION_CONFLICT");
  }

  try {
    const result = await database
      .prepare(
        `INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
         SELECT ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM decks
           WHERE user_id = ? AND deck_id = ? AND revision = ?
         )`,
      )
      .bind(userId, deckId, now, userId, deckId, expectedRevision)
      .run();
    if (result.meta?.changes === 0) {
      throw new Error("DECK_REVISION_CONFLICT");
    }
  } catch (error) {
    if (errorHasCode(error, "TOMBSTONE_LIMIT_REACHED")) {
      throw new Error("TOMBSTONE_LIMIT_REACHED", { cause: error });
    }
    const racedTombstone = await findTombstone(database, userId, deckId);
    if (racedTombstone) {
      return { deckId, deletedAt: racedTombstone.deleted_at, replayed: true };
    }
    throw new Error("DECK_REVISION_CONFLICT", { cause: error });
  }

  return { deckId, deletedAt: now, replayed: false };
}

export async function setActiveDeck(
  database: D1DatabaseLike,
  userId: string,
  activeDeckId: string | null,
  expectedRevision: number | null,
  now: number,
): Promise<{ activeDeck: ActiveDeckState; replayed: boolean }> {
  requireResourceId(userId, "USER_ID_INVALID");
  if (activeDeckId !== null) {
    requireResourceId(activeDeckId, "DECK_ID_INVALID");
  }
  if (
    expectedRevision !== null &&
    (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
  ) {
    throw new Error("ACTIVE_DECK_REVISION_INVALID");
  }
  requireNow(now);

  const ownedDeck = activeDeckId === null
    ? null
    : await findDeck(database, userId, activeDeckId);
  if (activeDeckId !== null && (!ownedDeck || !parseBootstrapDeck(ownedDeck))) {
    throw new Error("ACTIVE_DECK_INVALID");
  }

  const current = await findActiveDeck(database, userId);
  if (current?.active_deck_id === activeDeckId) {
    return { activeDeck: mapActiveDeck(current), replayed: true };
  }
  if (!current && expectedRevision !== null) {
    throw new Error("ACTIVE_DECK_REVISION_CONFLICT");
  }
  if (current && expectedRevision !== current.revision) {
    throw new Error("ACTIVE_DECK_REVISION_CONFLICT");
  }

  try {
    if (!current) {
      await database
        .prepare(
          `INSERT INTO user_preferences
            (user_id, active_deck_id, revision, server_updated_at)
           VALUES (?, ?, 1, ?)`,
        )
        .bind(userId, activeDeckId, now)
        .run();
    } else {
      const result = await database
        .prepare(
          `UPDATE user_preferences
           SET active_deck_id = ?, revision = revision + 1, server_updated_at = ?
           WHERE user_id = ? AND revision = ?`,
        )
        .bind(activeDeckId, now, userId, current.revision)
        .run();
      if (result.meta?.changes === 0) {
        throw new Error("ACTIVE_DECK_REVISION_CONFLICT");
      }
    }
  } catch {
    const raced = await findActiveDeck(database, userId);
    if (raced?.active_deck_id === activeDeckId) {
      return { activeDeck: mapActiveDeck(raced), replayed: true };
    }
    if (activeDeckId !== null) {
      const stillOwned = await findDeck(database, userId, activeDeckId);
      if (!stillOwned || !parseBootstrapDeck(stillOwned)) {
        throw new Error("ACTIVE_DECK_INVALID");
      }
    }
    throw new Error("ACTIVE_DECK_REVISION_CONFLICT");
  }

  const saved = await findActiveDeck(database, userId);
  if (!saved) throw new Error("ACTIVE_DECK_WRITE_FAILED");
  return { activeDeck: mapActiveDeck(saved), replayed: false };
}

function canonicalMatch(input: MatchInput): string {
  return JSON.stringify({
    matchId: input.matchId,
    playedAt: input.playedAt,
    deckId: input.deckId,
    deckRevision: input.deckRevision,
    deckName: input.deckName,
    cpuRequestedDifficulty: input.cpuRequestedDifficulty,
    cpuEffectiveDifficulty: input.cpuEffectiveDifficulty,
    cpuPolicyVersion: input.cpuPolicyVersion,
    outcome: input.outcome,
    turnCount: input.turnCount,
    appVersion: input.appVersion,
  });
}

async function hashMatch(input: MatchInput): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalMatch(input)),
  );
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

async function findMatchHash(
  database: D1DatabaseLike,
  userId: string,
  matchId: string,
): Promise<MatchHashRow | null> {
  return database
    .prepare(
      `SELECT request_hash FROM matches
       WHERE user_id = ? AND match_id = ?
       LIMIT 1`,
    )
    .bind(userId, matchId)
    .first<MatchHashRow>();
}

export async function appendMatch(
  database: D1DatabaseLike,
  userId: string,
  rawInput: MatchInput,
  now: number,
): Promise<{ matchId: string; replayed: boolean }> {
  requireResourceId(userId, "USER_ID_INVALID");
  requireNow(now);
  const input = validateMatchInput(rawInput, now);
  const requestHash = await hashMatch(input);
  await cleanupExpiredMatches(database, userId, now);
  const existing = await findMatchHash(database, userId, input.matchId);
  if (existing) {
    if (existing.request_hash === requestHash) {
      return { matchId: input.matchId, replayed: true };
    }
    throw new Error("MATCH_ID_CONFLICT");
  }

  try {
    await database
      .prepare(
        `INSERT INTO matches
          (user_id, match_id, played_at, expires_at, first_ingested_at,
           deck_id, deck_revision, deck_name_snapshot,
           cpu_requested_difficulty, cpu_effective_difficulty,
           cpu_policy_version, outcome, turn_count, app_version, request_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        userId,
        input.matchId,
        input.playedAt,
        input.playedAt + MATCH_RETENTION_MS,
        now,
        input.deckId,
        input.deckRevision,
        input.deckName,
        input.cpuRequestedDifficulty,
        input.cpuEffectiveDifficulty,
        input.cpuPolicyVersion,
        input.outcome,
        input.turnCount,
        input.appVersion,
        requestHash,
      )
      .run();
  } catch (error) {
    const raced = await findMatchHash(database, userId, input.matchId);
    if (raced?.request_hash === requestHash) {
      return { matchId: input.matchId, replayed: true };
    }
    if (errorHasCode(error, "MATCH_LIMIT_REACHED")) {
      throw new Error("MATCH_LIMIT_REACHED", { cause: error });
    }
    throw new Error("MATCH_ID_CONFLICT", { cause: error });
  }
  return { matchId: input.matchId, replayed: false };
}

export async function loadBootstrap(
  database: D1DatabaseLike,
  userId: string,
  now: number,
): Promise<CloudBootstrap> {
  requireResourceId(userId, "USER_ID_INVALID");
  requireNow(now);
  await cleanupExpiredMatches(database, userId, now);
  const [deckQuota, tombstoneResult, storedActiveDeck, stats] = await Promise.all([
    loadDeckQuotaSnapshot(database, userId),
    database
      .prepare(
        `SELECT deck_id, deleted_at
         FROM deck_tombstones
         WHERE user_id = ?
         ORDER BY deleted_at, deck_id
         LIMIT ?`,
      )
      .bind(userId, MAX_TOMBSTONES + 1)
      .all<TombstoneRow>(),
    findActiveDeck(database, userId),
    database
      .prepare(
        `SELECT matches, wins, losses
         FROM user_match_stats
         WHERE user_id = ?
         LIMIT 1`,
      )
      .bind(userId)
      .first<StatsRow>(),
  ]);

  const tombstoneRows = tombstoneResult.results ?? [];
  if (
    deckQuota.rows.length > MAX_STORED_DECK_ROWS
    || deckQuota.legalDecks.length > MAX_DECKS
    || tombstoneRows.length > MAX_TOMBSTONES
  ) {
    throw new Error("SYNC_DATA_LIMIT_EXCEEDED");
  }
  const repairedActive = await repairQuarantinedActiveDeck(
    database,
    userId,
    storedActiveDeck,
    deckQuota.rows,
    now,
  );
  const decks = [...deckQuota.legalDecks];
  if (repairedActive.refreshedDeck) {
    const index = decks.findIndex(
      ({ deckId }) => deckId === repairedActive.refreshedDeck?.deckId,
    );
    if (index === -1) decks.push(repairedActive.refreshedDeck);
    else decks[index] = repairedActive.refreshedDeck;
  }
  if (decks.length > MAX_DECKS) throw new Error("SYNC_DATA_LIMIT_EXCEEDED");
  const matches = stats?.matches ?? 0;
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  return {
    decks,
    deletedDecks: tombstoneRows.map((row) => ({
      deckId: row.deck_id,
      deletedAt: row.deleted_at,
    })),
    activeDeck: repairedActive.activeDeck
      ? mapActiveDeck(repairedActive.activeDeck)
      : null,
    stats: {
      matches,
      wins,
      losses,
      winRate: matches === 0 ? null : wins / matches,
    },
  };
}
