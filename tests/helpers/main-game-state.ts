import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState } from '@/engine/types';

/** Main-action fixture. Tests using action predicates must not inherit turn0/auto. */
export function createMainGameState(player: 'self' | 'opp' = 'self'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 1, player, phase: 'main', isFirstPlayerFirstTurn: false };
  return state;
}
