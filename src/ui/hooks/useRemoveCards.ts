// Phase 7 Task 7.10: RemoveArea selector hook

import type { CardId } from '@/engine/types/game-state.js';
import { useGameStateStore } from '@/ui/state/store.js';

const EMPTY: CardId[] = [];

/**
 * gameState から指定 side のリムーブエリアカード配列を返す。
 * null 時は空配列。配列末尾が最新リムーブ。
 */
export function useRemoveCards(side: 'self' | 'opp'): CardId[] {
  return useGameStateStore((s) => s.gameState?.players[side].remove ?? EMPTY);
}
