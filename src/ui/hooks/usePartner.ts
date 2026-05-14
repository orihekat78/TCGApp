// Phase 7 Task 7.5: PartnerArea selector hook
// rules: 06-card-types.md §パートナー, 18-mr.md

import type { PartnerOnBoard } from '@/engine/types/game-state.js';
import { useGameStateStore } from '@/ui/state/store.js';

/**
 * gameState から指定 side のパートナーを選択する。
 * gameState が null のときは null を返す (UI は空ゾーンを描画)。
 */
export function usePartner(side: 'self' | 'opp'): PartnerOnBoard | null {
  return useGameStateStore((s) => s.gameState?.players[side].partner ?? null);
}
