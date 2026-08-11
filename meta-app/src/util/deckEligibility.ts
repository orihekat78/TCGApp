import type { DeckRecord } from "../data/types";
import { cardIdentityFor, isDeckIdentityCard } from "../data/cardIdentities.generated";

/**
 * HOME needs only a registry-free choice gate. The full card and copy-limit
 * validation remains in deckBridge when a match is actually started.
 */
export function isHomeDeckEligible(deck: DeckRecord | undefined): boolean {
  if (!deck || !Array.isArray(deck.cards)) return false;
  if (cardIdentityFor(deck.partner)?.kind !== "partner") return false;
  if (cardIdentityFor(deck.case)?.kind !== "case") return false;

  let total = 0;
  for (const entry of deck.cards) {
    if (!Number.isSafeInteger(entry.count) || entry.count < 1) return false;
    if (isDeckIdentityCard(entry.num)) return false;
    total += entry.count;
  }
  return total === 40;
}
