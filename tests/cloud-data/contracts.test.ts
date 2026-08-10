import { describe, expect, it } from "vitest";
import {
  validateDeckInput,
  validateMatchInput,
} from "../../src/cloud-data/contracts";
import { MATCH_RETENTION_MS } from "../../src/cloud-data/retention";

const validDeck = {
  deckId: "c94c11bb-cf59-4fc2-855d-bbfb3af70148",
  name: "少年探偵団・標準",
  partnerCardNum: "D08001",
  caseCardNum: "D08026",
  cards: [
    { cardNum: "D08005", count: 3 },
    { cardNum: "D08006", count: 37 },
  ],
  clientModifiedAt: 1_786_000_000_000,
  expectedRevision: 1,
};

const now = 1_786_000_000_000;
const validMatch = {
  matchId: "593431d6-b1b3-4f04-a7a8-65c01eb9a935",
  playedAt: now - 60_000,
  deckId: validDeck.deckId,
  deckRevision: 2,
  deckName: validDeck.name,
  cpuRequestedDifficulty: "normal",
  cpuEffectiveDifficulty: "normal",
  cpuPolicyVersion: "cpu-policy-v1",
  outcome: "win",
  turnCount: 8,
  appVersion: "1.0.0+881d2898",
};

describe("cloud deck contract", () => {
  it("accepts a structurally complete forty-card deck without changing print numbers", () => {
    expect(validateDeckInput(validDeck)).toEqual(validDeck);
  });

  it("rejects a deck whose main-card count is not forty", () => {
    expect(() =>
      validateDeckInput({
        ...validDeck,
        cards: [{ cardNum: "D08005", count: 39 }],
      }),
    ).toThrow("DECK_MAIN_COUNT_INVALID");
  });

  it("rejects duplicate print numbers before catalog validation", () => {
    expect(() =>
      validateDeckInput({
        ...validDeck,
        cards: [
          { cardNum: "D08005", count: 20 },
          { cardNum: "D08005", count: 20 },
        ],
      }),
    ).toThrow("DECK_CARD_DUPLICATE");
  });

  it("rejects fields that could smuggle images or unrelated data", () => {
    expect(() =>
      validateDeckInput({
        ...validDeck,
        cardImage: "data:image/png;base64,...",
      }),
    ).toThrow("DECK_FIELD_UNKNOWN");
  });
});

describe("cloud match contract", () => {
  it("accepts only the compact result payload", () => {
    expect(validateMatchInput(validMatch, now)).toEqual(validMatch);
  });

  it("rejects a result older than the one-month cloud window", () => {
    expect(() =>
      validateMatchInput(
        { ...validMatch, playedAt: now - 30 * 24 * 60 * 60 * 1000 - 1 },
        now,
      ),
    ).toThrow("MATCH_EXPIRED");
  });

  it("rejects a result exactly on the expired retention boundary", () => {
    expect(() =>
      validateMatchInput(
        { ...validMatch, playedAt: now - MATCH_RETENTION_MS },
        now,
      ),
    ).toThrow("MATCH_EXPIRED");
  });

  it("rejects a result more than five minutes in the future", () => {
    expect(() =>
      validateMatchInput(
        { ...validMatch, playedAt: now + 5 * 60 * 1000 + 1 },
        now,
      ),
    ).toThrow("MATCH_FUTURE");
  });

  it("requires authoritative CPU strength fields", () => {
    const withoutDifficulty = { ...validMatch } as Record<string, unknown>;
    delete withoutDifficulty.cpuEffectiveDifficulty;
    expect(() => validateMatchInput(withoutDifficulty, now)).toThrow(
      "MATCH_CPU_DIFFICULTY_REQUIRED",
    );
  });

  it("shares the database maximum of one thousand turns", () => {
    expect(() =>
      validateMatchInput({ ...validMatch, turnCount: 1_001 }, now),
    ).toThrow("MATCH_TURN_COUNT_INVALID");
  });

  it("rejects replay, GameState, and operation-history fields", () => {
    expect(() =>
      validateMatchInput({ ...validMatch, replay: [] }, now),
    ).toThrow("MATCH_FIELD_UNKNOWN");
    expect(() =>
      validateMatchInput({ ...validMatch, gameState: {} }, now),
    ).toThrow("MATCH_FIELD_UNKNOWN");
    expect(() =>
      validateMatchInput({ ...validMatch, operations: [] }, now),
    ).toThrow("MATCH_FIELD_UNKNOWN");
  });
});
