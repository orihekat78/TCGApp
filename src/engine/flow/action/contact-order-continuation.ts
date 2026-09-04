import type { ActionContext, GameState } from '../../types/index.js';
import { event } from '../../event/index.js';
import { char as readChar } from '../../read/char.js';
import { actionCorrelationEventId } from './causal.js';
import { computeOrder } from './order.js';

function contactParticipants(ax: ActionContext): { aUid: string; bUid: string } | null {
  if (ax.guardUid) return { aUid: ax.byUid, bUid: ax.guardUid };
  if (ax.target.kind === 'char') return { aUid: ax.byUid, bUid: ax.target.uid };
  return null;
}

function isContactParticipantPresent(state: GameState, uid: string): boolean {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const player = uid === 'partner:self' ? 'self' : 'opp';
    return state.players[player].partner.location === 'partner-area';
  }
  return state.players.self.scene.some(character => character.uid === uid)
    || state.players.opp.scene.some(character => character.uid === uid);
}

/**
 * End an already-started contact when either participant has left the field.
 * This same rule applies before order is set and after every action window.
 */
export function endContactIfParticipantMissing(state: GameState, ax: ActionContext): boolean {
  if (!hasMissingContactParticipant(state, ax)) return false;
  delete ax.firstUid;
  delete ax.secondUid;
  ax.phase = 'contact-end';
  event.emit(state, 'contact:end', {}, { player: ax.byPlayer, uid: ax.byUid }, {
    causalCorrelationEventId: actionCorrelationEventId(ax),
  });
  return true;
}

/** Pure public-action gate for the same participant-presence rule. */
export function hasMissingContactParticipant(state: GameState, ax: ActionContext): boolean {
  const participants = contactParticipants(ax);
  return participants !== null
    && (!isContactParticipantPresent(state, participants.aUid)
      || !isContactParticipantPresent(state, participants.bUid));
}

/**
 * Confirm one contact's action order only after every contact:start effect has
 * drained. The phase is GameState-owned so human decisions can pause and resume
 * without freezing order from pre-effect AP.
 */
export function continuePendingContactOrder(state: GameState): boolean {
  if (state.gameResult !== undefined) return false;
  if (state.pendingEffects.some(entry => entry.state === 'pending')) return false;

  const ax = Object.values(state.actionContexts ?? {})
    .find(context => context.phase === 'contact-order-pending');
  if (!ax) return false;

  const participants = contactParticipants(ax);
  if (!participants) return false;
  const { aUid, bUid } = participants;
  // rules/08-contact §6: if either participant left while contact:start effects
  // resolved, skip every action window and proceed immediately to contact end.
  if (endContactIfParticipantMissing(state, ax)) return true;
  const order = computeOrder(readChar.ap(state, aUid), readChar.ap(state, bUid), { aUid, bUid });
  ax.firstUid = order.firstUid;
  ax.secondUid = order.secondUid;

  event.emit(
    state,
    'contact:order-set',
    { firstUid: order.firstUid, secondUid: order.secondUid },
    { player: ax.byPlayer, uid: ax.byUid },
    { causalCorrelationEventId: ax.contactCausalEventId },
  );
  ax.phase = 'action-1';
  return true;
}
