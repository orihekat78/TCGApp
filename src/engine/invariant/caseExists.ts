// engine.invariant.caseExists — 事件カード存在確認

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * 事件カードが存在する (cardId が空でない) ことを確認する
 */
export function caseExists(s: GameState, p: Player): void {
  if (!s.players[p].case.cardId) {
    throw new Error(`caseExists: player ${p} has no case card (cardId is empty)`);
  }
}
