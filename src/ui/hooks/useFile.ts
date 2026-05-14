// Phase 7 Task 7.8: FileArea selector hook

import type { FileCard } from '@/engine/types/game-state.js';
import { useGameStateStore } from '@/ui/state/store.js';

const EMPTY: FileCard[] = [];

/**
 * gameState.players[side].file (FileCard[]) を返す。null 時は EMPTY。
 */
export function useFile(side: 'self' | 'opp'): FileCard[] {
  return useGameStateStore((s) => s.gameState?.players[side].file ?? EMPTY);
}
