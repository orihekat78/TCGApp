import type { DeckRecord } from "../data/types";
import {
  BUG_274_PARTNER_CARD,
  BUG_274_PARTNER_ID,
  isBug274ValidationDeck,
} from "../data/bug274ValidationDeck";
import { deckLegalityCatalogResolver } from "../../../src/shared/deck-legality-catalog.generated";
import { DEFAULT_DECK_LIMIT, validateDeckLegality } from "../../../src/shared/deck-legality";

/**
 * HOME uses the same compact catalog and rule authority as cloud and import.
 */
export function isHomeDeckEligible(deck: DeckRecord | undefined): boolean {
  if (!deck || !Array.isArray(deck.cards)) return false;
  const main: Array<{ printingId: string; count: number }> = [];
  for (const rawEntry of deck.cards as unknown[]) {
    if (typeof rawEntry !== "object" || rawEntry === null || Array.isArray(rawEntry)) {
      return false;
    }
    const entry = rawEntry as { num?: unknown; count?: unknown };
    if (typeof entry.num !== "string" || !Number.isSafeInteger(entry.count)) {
      return false;
    }
    main.push({ printingId: entry.num, count: entry.count as number });
  }
  const resolve = isBug274ValidationDeck(deck)
    ? (printingId: string) => printingId === BUG_274_PARTNER_ID
      ? {
          printingId,
          officialId: BUG_274_PARTNER_CARD.id,
          kind: BUG_274_PARTNER_CARD.type,
          deckLimit: BUG_274_PARTNER_CARD.deckLimit ?? DEFAULT_DECK_LIMIT,
        }
      : deckLegalityCatalogResolver(printingId)
    : deckLegalityCatalogResolver;
  return validateDeckLegality({
    partner: deck.partner,
    case: deck.case,
    main,
  }, resolve).ok;
}
