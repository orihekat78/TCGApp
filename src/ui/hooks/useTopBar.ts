// Phase 7 Task 7.12: TopBar selector hook

import type { GameState } from '@/engine/types/game-state.js';
import { useGameStateStore } from '@/ui/state/store.js';

export type TopBarData = {
  turn: GameState['turn'];
  scratchTrace: GameState['scratchTrace'];
  effectStackCount: number;
};

const DEFAULT: TopBarData = {
  turn: { number: 1, player: 'self', phase: 'auto', isFirstPlayerFirstTurn: true },
  scratchTrace: { self: '未発見', opp: '未発見' },
  effectStackCount: 0,
};

/** Resolved entries are retained as history and are not an active stack. */
export function countUnresolvedEffects(gameState: GameState): number {
  return gameState.pendingEffects.filter((entry) => entry.state === 'pending' || entry.state === 'resolving').length;
}

/**
 * gameState から TopBar 用データを返す。null 時は DEFAULT。
 */
export function useTopBar(): TopBarData {
  return useGameStateStore((s) => {
    if (!s.gameState) return DEFAULT;
    return {
      turn: s.gameState.turn,
      scratchTrace: s.gameState.scratchTrace,
      effectStackCount: countUnresolvedEffects(s.gameState),
    };
  });
}
