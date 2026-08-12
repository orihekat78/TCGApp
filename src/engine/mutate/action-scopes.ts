import type { GameState } from '@/engine/types';
import { char } from './char.js';

/** Clears effects whose lifetime cannot outlive the action that granted them. */
export function clearActionScopedState(state: GameState): void {
  for (const player of ['self', 'opp'] as const) {
    for (const sceneChar of state.players[player].scene) {
      if (sceneChar.turnEffects === undefined) continue;
      char.clearTurnEffects(state, sceneChar.uid, 'action');
    }
    char.clearTurnEffects(state, `partner:${player}`, 'action');
  }
  state.turnState.self.hiramekiSuppressed = false;
  state.turnState.opp.hiramekiSuppressed = false;
}

/** Clears effects whose lifetime is bounded by the current contact. */
export function clearContactScopedState(state: GameState): void {
  for (const player of ['self', 'opp'] as const) {
    for (const sceneChar of state.players[player].scene) {
      if (sceneChar.turnEffects === undefined) continue;
      char.clearTurnEffects(state, sceneChar.uid, 'contact');
    }
    char.clearTurnEffects(state, `partner:${player}`, 'contact');
  }
}

/** Terminal state has no resumable action, contact, or action-scoped effects. */
export function clearTerminalActionState(state: GameState): void {
  clearActionScopedState(state);
  clearContactScopedState(state);
  state.actionContexts = {};
}
