import type { GameState } from '../../types/index.js';

type Player = 'self' | 'opp';

/** Official main-phase actions belong only to the current turn player. */
export function isMainActionWindow(state: GameState, player: Player): boolean {
  return state.turn.player === player && state.turn.phase === 'main';
}
