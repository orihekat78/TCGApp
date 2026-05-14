// Phase 7 Task 7.6: CaseArea selector hook
// rules: 06-card-types.md §事件, 01-victory-conditions.md

import type { PlayerState } from '@/engine/types/game-state.js';
import { useGameStateStore } from '@/ui/state/store.js';

/** engine の `players[side].case` を返す。null 時は null。 */
export function useCase(
  side: 'self' | 'opp',
): PlayerState['case'] | null {
  return useGameStateStore((s) => s.gameState?.players[side].case ?? null);
}
