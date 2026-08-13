// Public, deterministic regression fixture for BUG-274.
// It is deliberately not persisted as a user deck or included in the card catalog.

import type { CardDef, DeckRecord } from './types';
import { SAMPLE_DECK } from './sampleDeck';

export const BUG_274_PUBLIC_DECK_ID = 'test-bug-274-public';
export const BUG_274_PARTNER_ID = 'TEST-BUG-274-PARTNER';

export const BUG_274_PUBLIC_DECK: DeckRecord = {
  id: BUG_274_PUBLIC_DECK_ID,
  name: 'TEST — BUG-274 Escape（複数能力）',
  partner: BUG_274_PARTNER_ID,
  case: 'D08026',
  cards: SAMPLE_DECK.cards.map((entry) => ({ ...entry })),
  modified: 0,
};

/**
 * The validation deck is route-owned data, not an identity a persisted deck can
 * claim. JSON hydration/import always creates a different object.
 */
export function isBug274ValidationDeck(deck: DeckRecord | undefined): boolean {
  return deck === BUG_274_PUBLIC_DECK;
}

export const BUG_274_PARTNER_CARD: CardDef = {
  num: BUG_274_PARTNER_ID,
  id: BUG_274_PARTNER_ID,
  name: 'BUG-274 検証パートナー',
  color: 'blue',
  colors: ['blue'],
  type: 'partner',
  lp: 1,
  rarity: 'TEST',
  keywords: ['宣言'],
  effectShort: '検証専用能力 A（実行しない）\n検証専用能力 B（実行しない）',
};
