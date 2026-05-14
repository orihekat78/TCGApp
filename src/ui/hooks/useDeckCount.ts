// Phase 7 Task 7.7: DeckArea selector hook

import { useGameStateStore } from '@/ui/state/store.js';

/**
 * gameState から指定 side のデッキ枚数を返す。
 * gameState が null のときは 0。
 */
export function useDeckCount(side: 'self' | 'opp'): number {
  return useGameStateStore((s) => s.gameState?.players[side].deck.length ?? 0);
}
