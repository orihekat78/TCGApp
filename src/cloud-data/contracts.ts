const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CARD_NUM = /^[A-Za-z0-9-]{1,24}$/;

const deckFields = new Set([
  "deckId",
  "name",
  "partnerCardNum",
  "caseCardNum",
  "cards",
  "clientModifiedAt",
  "expectedRevision",
]);

const matchFields = new Set([
  "matchId",
  "playedAt",
  "deckId",
  "deckRevision",
  "deckName",
  "cpuRequestedDifficulty",
  "cpuEffectiveDifficulty",
  "cpuPolicyVersion",
  "outcome",
  "turnCount",
  "appVersion",
]);

export type DeckInput = {
  deckId: string;
  name: string;
  partnerCardNum: string;
  caseCardNum: string;
  cards: Array<{ cardNum: string; count: number }>;
  clientModifiedAt: number;
  expectedRevision: number | null;
};

export type CpuDifficulty = "weak" | "normal" | "strong";

export type MatchInput = {
  matchId: string;
  playedAt: number;
  deckId: string;
  deckRevision: number;
  deckName: string;
  cpuRequestedDifficulty: CpuDifficulty;
  cpuEffectiveDifficulty: CpuDifficulty;
  cpuPolicyVersion: string;
  outcome: "win" | "loss";
  turnCount: number;
  appVersion: string;
};

function record(input: unknown, code: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new Error(code);
  return input as Record<string, unknown>;
}

function rejectUnknownFields(
  input: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  code: string,
): void {
  if (Object.keys(input).some((key) => !allowed.has(key)))
    throw new Error(code);
}

function requiredString(
  value: unknown,
  pattern: RegExp,
  code: string,
  maxLength = 128,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    !pattern.test(value)
  ) {
    throw new Error(code);
  }
  return value;
}

function positiveInteger(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new Error(code);
  return value as number;
}

export function validateDeckInput(input: unknown): DeckInput {
  const candidate = record(input, "DECK_INVALID");
  rejectUnknownFields(candidate, deckFields, "DECK_FIELD_UNKNOWN");

  const deckId = requiredString(
    candidate.deckId,
    RESOURCE_ID,
    "DECK_ID_INVALID",
  );
  if (
    typeof candidate.name !== "string" ||
    candidate.name.trim().length === 0 ||
    candidate.name.length > 80
  ) {
    throw new Error("DECK_NAME_INVALID");
  }
  const partnerCardNum = requiredString(
    candidate.partnerCardNum,
    CARD_NUM,
    "DECK_PARTNER_INVALID",
    24,
  );
  const caseCardNum = requiredString(
    candidate.caseCardNum,
    CARD_NUM,
    "DECK_CASE_INVALID",
    24,
  );
  if (
    !Array.isArray(candidate.cards) ||
    candidate.cards.length === 0 ||
    candidate.cards.length > 40
  ) {
    throw new Error("DECK_CARDS_INVALID");
  }

  const seen = new Set<string>();
  const cards = candidate.cards.map((rawCard) => {
    const card = record(rawCard, "DECK_CARD_INVALID");
    rejectUnknownFields(
      card,
      new Set(["cardNum", "count"]),
      "DECK_CARD_FIELD_UNKNOWN",
    );
    const cardNum = requiredString(
      card.cardNum,
      CARD_NUM,
      "DECK_CARD_NUM_INVALID",
      24,
    );
    if (seen.has(cardNum)) throw new Error("DECK_CARD_DUPLICATE");
    seen.add(cardNum);
    return {
      cardNum,
      count: positiveInteger(card.count, "DECK_CARD_COUNT_INVALID"),
    };
  });
  if (cards.reduce((total, card) => total + card.count, 0) !== 40) {
    throw new Error("DECK_MAIN_COUNT_INVALID");
  }
  if (
    !Number.isSafeInteger(candidate.clientModifiedAt) ||
    (candidate.clientModifiedAt as number) < 0
  ) {
    throw new Error("DECK_MODIFIED_INVALID");
  }
  if (
    candidate.expectedRevision !== null &&
    (!Number.isSafeInteger(candidate.expectedRevision) ||
      (candidate.expectedRevision as number) < 1)
  ) {
    throw new Error("DECK_REVISION_INVALID");
  }

  return {
    deckId,
    name: candidate.name,
    partnerCardNum,
    caseCardNum,
    cards,
    clientModifiedAt: candidate.clientModifiedAt as number,
    expectedRevision: candidate.expectedRevision as number | null,
  };
}

export function validateMatchInput(input: unknown, now: number): MatchInput {
  const candidate = record(input, "MATCH_INVALID");
  rejectUnknownFields(candidate, matchFields, "MATCH_FIELD_UNKNOWN");

  if (!Number.isSafeInteger(candidate.playedAt))
    throw new Error("MATCH_PLAYED_AT_INVALID");
  const playedAt = candidate.playedAt as number;
  if (playedAt <= now - MONTH_MS) throw new Error("MATCH_EXPIRED");
  if (playedAt > now + FUTURE_SKEW_MS) throw new Error("MATCH_FUTURE");

  const difficulties = new Set<CpuDifficulty>(["weak", "normal", "strong"]);
  if (
    !difficulties.has(candidate.cpuRequestedDifficulty as CpuDifficulty) ||
    !difficulties.has(candidate.cpuEffectiveDifficulty as CpuDifficulty)
  ) {
    throw new Error("MATCH_CPU_DIFFICULTY_REQUIRED");
  }
  if (candidate.outcome !== "win" && candidate.outcome !== "loss") {
    throw new Error("MATCH_OUTCOME_INVALID");
  }
  if (
    !Number.isSafeInteger(candidate.turnCount) ||
    (candidate.turnCount as number) < 1 ||
    (candidate.turnCount as number) > 1_000
  ) {
    throw new Error("MATCH_TURN_COUNT_INVALID");
  }
  if (
    typeof candidate.deckName !== "string" ||
    candidate.deckName.trim().length === 0 ||
    candidate.deckName.length > 80
  ) {
    throw new Error("MATCH_DECK_NAME_INVALID");
  }

  return {
    matchId: requiredString(candidate.matchId, RESOURCE_ID, "MATCH_ID_INVALID"),
    playedAt,
    deckId: requiredString(
      candidate.deckId,
      RESOURCE_ID,
      "MATCH_DECK_ID_INVALID",
    ),
    deckRevision: positiveInteger(
      candidate.deckRevision,
      "MATCH_DECK_REVISION_INVALID",
    ),
    deckName: candidate.deckName,
    cpuRequestedDifficulty: candidate.cpuRequestedDifficulty as CpuDifficulty,
    cpuEffectiveDifficulty: candidate.cpuEffectiveDifficulty as CpuDifficulty,
    cpuPolicyVersion: requiredString(
      candidate.cpuPolicyVersion,
      /^[A-Za-z0-9._+-]{1,80}$/,
      "MATCH_CPU_POLICY_INVALID",
      80,
    ),
    outcome: candidate.outcome,
    turnCount: candidate.turnCount as number,
    appVersion: requiredString(
      candidate.appVersion,
      /^[A-Za-z0-9._+-]{1,120}$/,
      "MATCH_APP_VERSION_INVALID",
      120,
    ),
  };
}
