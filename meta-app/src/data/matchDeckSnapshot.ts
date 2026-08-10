import type { DeckRecord, MatchDeckCardEntry, MatchDeckSnapshotV1 } from './types';

const MAX_CARD_ENTRIES = 160;
const MAX_TEXT_LENGTH = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, MAX_TEXT_LENGTH) : undefined;
}

function normalizeCardEntry(value: unknown): MatchDeckCardEntry | undefined {
  if (!isRecord(value)) return undefined;
  const num = nonEmptyText(value.num);
  if (!num || !Number.isInteger(value.count) || (value.count as number) < 1 || (value.count as number) > 40) {
    return undefined;
  }
  return { num, count: value.count as number };
}

/** Deeply copies the public pre-match deck list for later history inspection. */
export function captureMatchDeckSnapshot(deck: DeckRecord): MatchDeckSnapshotV1 {
  return {
    schemaVersion: 1,
    deckId: deck.id,
    name: deck.name,
    partner: deck.partner,
    case: deck.case,
    cards: deck.cards.map(({ num, count }) => ({ num, count })),
  };
}

/** Rejects malformed snapshots without invalidating the containing legacy history row. */
export function normalizeMatchDeckSnapshot(value: unknown): MatchDeckSnapshotV1 | undefined {
  if (!isRecord(value) || value.schemaVersion !== 1) return undefined;
  const name = nonEmptyText(value.name);
  const partner = nonEmptyText(value.partner);
  const incident = nonEmptyText(value.case);
  if (!name || !partner || !incident || !Array.isArray(value.cards)) return undefined;

  if (value.cards.length > MAX_CARD_ENTRIES) return undefined;
  const cards = value.cards.map(normalizeCardEntry);
  if (cards.some((entry) => entry === undefined)) return undefined;
  const normalizedCards = cards as MatchDeckCardEntry[];
  if (normalizedCards.reduce((total, entry) => total + entry.count, 0) !== 40) return undefined;
  const deckId = nonEmptyText(value.deckId);
  return {
    schemaVersion: 1,
    ...(deckId ? { deckId } : {}),
    name,
    partner,
    case: incident,
    cards: normalizedCards,
  };
}
