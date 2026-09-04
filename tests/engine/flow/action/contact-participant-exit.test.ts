// rules: 08-contact §6 — either participant leaving ends contact before another action window.

import { beforeEach, describe, expect, it } from 'vitest';
import { event } from '@/engine/event';
import { advance } from '@/engine/flow/action/state-machine';
import { createEmptyGameState } from '@/engine/state-factory';
import type { ActionContext, ActionPhase, GameState } from '@/engine/types';
import { sceneChar } from '../../../helpers/fixtures';

const ACTION_ID = 'contact-participant-exit';
const ATTACKER_UID = 'participant-attacker';
const DEFENDER_UID = 'participant-defender';

function stateAt(phase: ActionPhase, missing?: 'attacker' | 'defender'): {
  state: GameState;
  context: ActionContext;
} {
  const state = createEmptyGameState();
  if (missing !== 'attacker') state.players.self.scene = [sceneChar('ATTACKER', ATTACKER_UID)];
  if (missing !== 'defender') state.players.opp.scene = [sceneChar('DEFENDER', DEFENDER_UID)];
  const context: ActionContext = {
    id: ACTION_ID,
    byUid: ATTACKER_UID,
    byPlayer: 'self',
    target: { kind: 'char', uid: DEFENDER_UID },
    phase,
    firstUid: ATTACKER_UID,
    secondUid: DEFENDER_UID,
    startedAt: { turn: 3, nano: 1 },
  };
  state.actionContexts = { [ACTION_ID]: context };
  return { state, context };
}

beforeEach(() => {
  event._resetRegistry();
});

describe('action FSM contact participant exit', () => {
  it.each([
    { phase: 'action-1' as const, missing: 'attacker' as const },
    { phase: 'action-1' as const, missing: 'defender' as const },
    { phase: 'action-2' as const, missing: 'attacker' as const },
    { phase: 'action-2' as const, missing: 'defender' as const },
    { phase: 'action-1-redo' as const, missing: 'attacker' as const },
    { phase: 'action-1-redo' as const, missing: 'defender' as const },
  ])('ends from $phase when $missing left before advance', ({ phase, missing }) => {
    const { state, context } = stateAt(phase, missing);
    let contactEnds = 0;
    event.on('contact:end', () => { contactEnds += 1; });

    advance(state, context);

    expect(context.phase).toBe('contact-end');
    expect(context.firstUid).toBeUndefined();
    expect(context.secondUid).toBeUndefined();
    expect(contactEnds).toBe(1);
  });

  it('keeps the normal action-1 to action-2 transition while both participants remain', () => {
    const { state, context } = stateAt('action-1');
    let contactEnds = 0;
    event.on('contact:end', () => { contactEnds += 1; });

    advance(state, context);

    expect(context.phase).toBe('action-2');
    expect(context.firstUid).toBe(ATTACKER_UID);
    expect(context.secondUid).toBe(DEFENDER_UID);
    expect(contactEnds).toBe(0);
  });

  it('keeps contact on the attacker and guarder after the original target left', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('ATTACKER', ATTACKER_UID)];
    state.players.opp.scene = [sceneChar('GUARDER', 'participant-guarder')];
    const context: ActionContext = {
      id: ACTION_ID,
      byUid: ATTACKER_UID,
      byPlayer: 'self',
      target: { kind: 'char', uid: DEFENDER_UID },
      guardUid: 'participant-guarder',
      phase: 'action-1',
      firstUid: ATTACKER_UID,
      secondUid: 'participant-guarder',
      startedAt: { turn: 3, nano: 1 },
    };
    state.actionContexts = { [ACTION_ID]: context };

    advance(state, context);

    expect(context.phase).toBe('action-2');
    expect(context.firstUid).toBe(ATTACKER_UID);
    expect(context.secondUid).toBe('participant-guarder');
  });

  it.each([
    { missingUid: 'partner:self', byUid: 'partner:self', byPlayer: 'self' as const, targetUid: DEFENDER_UID },
    { missingUid: 'partner:opp', byUid: 'partner:opp', byPlayer: 'opp' as const, targetUid: ATTACKER_UID },
  ])('ends when missing partner participant $missingUid left its area', ({ missingUid, byUid, byPlayer, targetUid }) => {
    const state = createEmptyGameState();
    state.players.self.scene = targetUid === ATTACKER_UID ? [sceneChar('ATTACKER', ATTACKER_UID)] : [];
    state.players.opp.scene = targetUid === DEFENDER_UID ? [sceneChar('DEFENDER', DEFENDER_UID)] : [];
    if (missingUid === 'partner:self') state.players.self.partner.location = 'file-area';
    if (missingUid === 'partner:opp') state.players.opp.partner.location = 'file-area';
    const context: ActionContext = {
      id: ACTION_ID,
      byUid,
      byPlayer,
      target: { kind: 'char', uid: targetUid },
      phase: 'action-1',
      firstUid: byUid,
      secondUid: targetUid,
      startedAt: { turn: 3, nano: 1 },
    };
    state.actionContexts = { [ACTION_ID]: context };

    advance(state, context);

    expect(context.phase).toBe('contact-end');
    expect(context.firstUid).toBeUndefined();
    expect(context.secondUid).toBeUndefined();
  });

  it('suppresses action:end for an effect-generated contact after a participant leaves', () => {
    const { state, context } = stateAt('action-1', 'defender');
    context.generatedByEffect = true;
    let contactEnds = 0;
    let actionEnds = 0;
    event.on('contact:end', () => { contactEnds += 1; });
    event.on('action:end', () => { actionEnds += 1; });

    advance(state, context);
    expect(context.phase).toBe('contact-end');
    advance(state, context);

    expect(state.actionContexts?.[ACTION_ID]).toBeUndefined();
    expect(contactEnds).toBe(1);
    expect(actionEnds).toBe(0);
  });
});
