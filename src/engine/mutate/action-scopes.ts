import type { GameState } from '@/engine/types';
import { char } from './char.js';
import { advanceIndexedZoneEpoch } from '../state/indexed-zone-epoch.js';
import { clearAllChooseInterceptBatchAuthorities } from '../effect/choose-intercept-authority.js';

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
  clearAllChooseInterceptBatchAuthorities(state);
  for (const entry of state.pendingEffects) {
    if (entry.state === 'pending' || entry.state === 'resolving') entry.state = 'cancelled';
  }
  for (const context of Object.values(state.actionContexts ?? {})) {
    const held = context.pendingHiramekiEvidenceRemoval;
    if (!held) continue;
    state.players[held.player].remove.push(held.evidence.cardId);
    advanceIndexedZoneEpoch(state, held.player, 'remove');
    delete context.pendingHiramekiEvidenceRemoval;
  }
  state.actionContexts = {};
  // A terminal GameState cannot retain a resumable resolver authority. Direct
  // terminal writers do not necessarily pass through the stack cleanup path.
  delete state.pendingRuntimeState;
  delete state.pendingTurnTransition;
  delete state.pendingReasoningContinuation;
  state.reservedEffects = [];
}
