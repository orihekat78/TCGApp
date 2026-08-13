// spec: .claude/specs/meta-ui/10-integration-with-src.md + 13-implementations.md
// meta DeckRecord と engine ID/Spec の橋渡し
// Phase 14-A: 任意 DeckRecord を validateDeck OK ならカスタム実機対戦可能に

import type { DeckId } from '@/ui/services/deckBuilder';
import { AVAILABLE_DECKS } from '@/ui/services/deckBuilder';
import type { DeckRecord } from '../data/types';
import {
  BUG_274_PARTNER_CARD,
  BUG_274_PARTNER_ID,
  isBug274ValidationDeck,
} from '../data/bug274ValidationDeck';
import { engineStub } from '../stubs/engineStub';

/** DeckRecord.id → engine DeckId (sample-d08 / sample-d11 専用)。
 *  カスタムデッキでは null を返すが、customGameStart 経由なら問題なく動作する */
export function toDeckId(deck: DeckRecord | undefined): DeckId | null {
  if (!deck) return null;
  if (deck.id === 'sample-d08') return 'CT-D08';
  if (deck.id === 'sample-d11') return 'CT-D11';
  if (isDeckId(deck.id)) return deck.id;
  return null;
}

/** デッキが対戦可能か (Phase 14-A: validateDeck OK なら可、deckId 経路にこだわらない) */
export function isPlayable(deck: DeckRecord | undefined): boolean {
  if (!deck) return false;
  const overlay = isBug274ValidationDeck(deck)
    ? (printingId: string) => printingId === BUG_274_PARTNER_ID ? BUG_274_PARTNER_CARD : undefined
    : undefined;
  return engineStub.cards.validateDeck(deck, overlay).ok;
}

function isDeckId(s: string): s is DeckId {
  return AVAILABLE_DECKS.some((d) => d.id === s);
}

export { AVAILABLE_DECKS };
export type { DeckId };
