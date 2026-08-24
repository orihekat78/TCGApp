// Horizontal regression for rules/08 §6: either participant leaving ends contact.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ATTACKER = 'W83-EXIT-ATTACKER';
const DEFENDER = 'W83-EXIT-DEFENDER';
const ATTACKER_UID = 'wave83-exit-attacker';
const DEFENDER_UID = 'wave83-exit-defender';

function fixture(id: string, ap: number): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黒'], level: 3,
    ap, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing contact exit regression state');
  return state;
}

function reachFirstWindow(): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: ATTACKER_UID, targetUid: DEFENDER_UID,
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const context = flow.action._getContext(current(), actionId);
    if (!context) throw new Error('contact ended before B01098 action window');
    if (context.phase === 'action-1') {
      expect(context.firstUid).toBe(ATTACKER_UID);
      expect(context.secondUid).toBe(DEFENDER_UID);
      return actionId;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('B01098 first action window not reached');
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  register(fixture(ATTACKER, 1000));
  register(fixture(DEFENDER, 9000));
  registerTriggeredListener();
  const state = createEmptyGameState();
  state.turn = { number: 30, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.hand = ['B01098'];
  state.players.self.scene = [sceneChar(ATTACKER, ATTACKER_UID, { state: 'active' })];
  state.players.opp.scene = [sceneChar(DEFENDER, DEFENDER_UID, { state: 'sleep' })];
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('contact participant exit horizontal regression', () => {
  it('B01098 removes both participants and exposes no second action or AP judge', () => {
    let contactEnds = 0;
    event.on('contact:end', () => { contactEnds += 1; });
    const actionId = reachFirstWindow();

    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'self', choice: { kind: 'cutin', cardId: 'B01098' },
    })).toEqual({ ok: true });
    expect(current().players.self.scene.some(card => card.uid === ATTACKER_UID)).toBe(false);
    expect(current().players.opp.scene.some(card => card.uid === DEFENDER_UID)).toBe(false);
    expect(flow.action._getContext(current(), actionId)?.phase).toBe('action-1');

    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    const context = flow.action._getContext(current(), actionId);
    expect(context?.phase).toBe('contact-end');
    expect(context?.firstUid).toBeUndefined();
    expect(context?.secondUid).toBeUndefined();
    expect(context?.judgeResolved).toBeUndefined();
    expect(contactEnds).toBe(1);
  });
});
