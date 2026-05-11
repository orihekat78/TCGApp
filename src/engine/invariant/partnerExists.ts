// engine.invariant.partnerExists — パートナー存在確認

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * パートナーが存在する (cardId が空でない) ことを確認する
 */
export function partnerExists(s: GameState, p: Player): void {
  if (!s.players[p].partner.cardId) {
    throw new Error(`partnerExists: player ${p} has no partner (cardId is empty)`);
  }
}
