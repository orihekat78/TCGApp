// qa: card:B06042:954b33bfb2a596a7ba88bb1d6476fd34416af93d38e8012a55157693df8c903a
// qa: card:B06042:e17af004e33c138a7c33cee5a0d3803c15371642fd7c595bb19e5d85c14adcc9
// qa: card:B06042:212eda580af7b7e0cb3b2a15d4fd3e9c95279fabf34572a483458fba04673b04

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B06042 } from '@/cards/ct-p06/B06042';
import { B08026 } from '@/cards/ct-p08/B08026';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow/index.js';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useContactFlowDriver } from '@/ui/hooks/useContactFlowDriver';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const QA = {
  sleepingHost: 'card:B06042:954b33bfb2a596a7ba88bb1d6476fd34416af93d38e8012a55157693df8c903a',
  independentGrants: 'card:B06042:e17af004e33c138a7c33cee5a0d3803c15371642fd7c595bb19e5d85c14adcc9',
  turnExpiry: 'card:B06042:212eda580af7b7e0cb3b2a15d4fd3e9c95279fabf34572a483458fba04673b04',
} as const;

const GRANTED_ID = 'b06042_granted_contact';
const ACTOR = 'B06042_LIFECYCLE_ACTOR';
const ATTACKER = 'B06042_LIFECYCLE_ATTACKER';
const TARGET = 'B06042_LIFECYCLE_TARGET';
const HATTORI = 'B06042_LIFECYCLE_HATTORI';
const FILLER = 'B06042_LIFECYCLE_FILLER';

function character(id: string, ap: number, names: string[] = [id]): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names,
    colors: [...B06042.colors],
    level: 1,
    ap,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const ACTOR_DEF = character(ACTOR, 5000);
const ATTACKER_DEF = character(ATTACKER, 4000);
const TARGET_DEF = character(TARGET, 1000);
const HATTORI_DEF = character(HATTORI, 3000, ['服部平次']);
const FILLER_DEF = character(FILLER, 1000);

function scene(cardId: string, uid: string, state: 'active' | 'sleep' = 'active') {
  return makeChar({ cardId, uid, state });
}

function baseState(options: {
  handCopies?: number;
  includeAttacker?: boolean;
  includeOhtakiPair?: boolean;
  targetCount?: number;
} = {}): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...B06042.colors];
  state.players.self.file = Array.from({ length: 8 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  state.players.self.hand = Array.from({ length: options.handCopies ?? 1 }, () => B06042.id);
  state.players.self.deck = Array.from({ length: 12 }, () => FILLER);
  state.players.opp.deck = Array.from({ length: 12 }, () => FILLER);
  state.players.self.scene = [scene(ACTOR, 'actor')];
  if (options.includeAttacker) state.players.self.scene.push(scene(ATTACKER, 'attacker'));
  if (options.includeOhtakiPair) {
    state.players.self.scene.push(
      scene(B08026.id, 'ohtaki-1'),
      scene(B08026.id, 'ohtaki-2'),
      scene(HATTORI, 'hattori'),
    );
  }
  state.players.opp.scene = Array.from({ length: options.targetCount ?? 1 }, (_, index) => (
    scene(TARGET, `target-${index + 1}`, index < 2 ? 'sleep' : 'active')
  ));
  return state;
}

function resetHarness(): void {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  for (const card of [B06042, B08026, ACTOR_DEF, ATTACKER_DEF, TARGET_DEF, HATTORI_DEF, FILLER_DEF]) {
    register(card);
  }
  registerTriggeredListener();
  beginMatchSession('self');
}

function install(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function currentState(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function ownerOf(uid: string): Player {
  return currentState().players.self.scene.some((card) => card.uid === uid) ? 'self' : 'opp';
}

function ContactDriverHarness(): null {
  useContactFlowDriver();
  return null;
}

function releaseCompletedAction(): void {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(createElement(ContactDriverHarness)));
  expect(useGameStateStore.getState().activeActionId).toBeNull();
  act(() => root.unmount());
}

function driveContactToEnd(actionId: string): void {
  for (let step = 0; step < 20; step += 1) {
    const context = flow.action._getContext(currentState(), actionId);
    if (!context) {
      releaseCompletedAction();
      return;
    }
    if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
      const actingUid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      expect(dispatchEngineAction({
        type: 'actionContact',
        actionId,
        player: ownerOf(actingUid!),
        choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    if (context.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error(`contact ${actionId} did not finish`);
}

function startNormalAction(byUid: string, targetUid: string): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid, targetUid })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  return actionId!;
}

function finishNormalAction(actionId: string): void {
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  driveContactToEnd(actionId);
}

function resolveCurrentPick(pickedUid: string | null): void {
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve',
    pickedUid,
  }))).toEqual({ ok: true });
}

function useB06042On(hostUid: string | null): void {
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B06042.id }))
    .toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.source).toMatchObject({ cardId: B06042.id, abilityId: 'a1' });
  if (hostUid) expect(pick?.candidates.map((candidate) => candidate.uid)).toContain(hostUid);
  resolveCurrentPick(hostUid);
}

function declareAndDecline(grantedId = GRANTED_ID): void {
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'actor', abilId: grantedId }))
    .toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.source).toMatchObject({ uid: 'actor', abilityId: grantedId });
  resolveCurrentPick(null);
}

function grantThroughOhtaki(sourceUid: string, hostUid: string | null): void {
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: sourceUid, abilId: 'a2' }))
    .toEqual({ ok: true });
  const eventPick = useGameStateStore.getState().pendingEffectPick;
  expect(eventPick?.atomVerb).toBe('useEventFromHand');
  const eventCandidate = eventPick?.candidates.find((candidate) => candidate.cardId === B06042.id);
  expect(eventCandidate).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(eventPick!, {
    type: 'effectPickResolve',
    pickedUid: eventCandidate!.uid,
  }))).toEqual({ ok: true });

  const hostPick = useGameStateStore.getState().pendingEffectPick;
  expect(hostPick?.source).toMatchObject({ cardId: B06042.id, abilityId: 'a1' });
  if (hostUid) expect(hostPick?.candidates.map((candidate) => candidate.uid)).toContain(hostUid);
  resolveCurrentPick(hostUid);
}

beforeEach(() => resetHarness());

afterEach(() => endMatchSession());

describe('B06042 public granted-ability lifecycle', () => {
  it(`${QA.sleepingHost}: an already-actioned sleeping host receives and later uses the grant`, () => {
    install(baseState({ includeAttacker: true, targetCount: 3 }));

    const firstAction = startNormalAction('actor', 'target-1');
    finishNormalAction(firstAction);
    expect(currentState().players.self.scene.find((card) => card.uid === 'actor')).toMatchObject({
      state: 'sleep',
      turnEffects: expect.objectContaining({ actedCharThisTurn: true }),
    });

    useB06042On('actor');
    expect(readChar.ap(currentState(), 'actor')).toBe(6000);
    expect(currentState().players.self.scene.find((card) => card.uid === 'actor')?.turnEffects.grantedAbilities)
      .toEqual([expect.objectContaining({ id: GRANTED_ID })]);

    const openAction = startNormalAction('attacker', 'target-2');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'actor', abilId: GRANTED_ID }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    finishNormalAction(openAction);

    declareAndDecline();
    expect(currentState().players.self.scene.find((card) => card.uid === 'actor')?.declaredUseCount[GRANTED_ID]).toBe(1);
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(currentState().log.filter((entry) => entry.action === 'effect:startContact')).toHaveLength(0);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'actor', abilId: GRANTED_ID }))
      .toEqual({ ok: false, reason: 'not-allowed' });
  });

  it(`${QA.independentGrants}: two physical event uses grant independent once-per-turn abilities`, () => {
    install(baseState({ handCopies: 2, includeOhtakiPair: true }));

    grantThroughOhtaki('ohtaki-1', 'actor');
    expect(currentState().players.self.hand.filter((cardId) => cardId === B06042.id)).toHaveLength(1);
    expect(currentState().players.self.remove.filter((cardId) => cardId === B06042.id)).toHaveLength(1);
    grantThroughOhtaki('ohtaki-2', 'actor');
    expect(currentState().players.self.hand.filter((cardId) => cardId === B06042.id)).toHaveLength(0);
    expect(currentState().players.self.remove.filter((cardId) => cardId === B06042.id)).toHaveLength(2);
    expect(currentState().players.self.scene.find((card) => card.uid === 'actor')?.turnEffects.grantedAbilities)
      .toEqual([
        expect.objectContaining({ id: GRANTED_ID }),
        expect.objectContaining({ id: `${GRANTED_ID}#1` }),
      ]);
    expect(readChar.ap(currentState(), 'actor')).toBe(7000);

    declareAndDecline(GRANTED_ID);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'actor', abilId: GRANTED_ID }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    declareAndDecline(`${GRANTED_ID}#1`);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'actor', abilId: `${GRANTED_ID}#1` }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(currentState().log.filter((entry) => entry.action === 'effect:startContact')).toHaveLength(0);

    resetHarness();
    install(baseState({ handCopies: 2, includeOhtakiPair: true }));
    grantThroughOhtaki('ohtaki-1', 'actor');
    grantThroughOhtaki('ohtaki-2', null);
    expect(currentState().players.self.scene.find((card) => card.uid === 'actor')?.turnEffects.grantedAbilities)
      .toEqual([expect.objectContaining({ id: GRANTED_ID })]);
    expect(readChar.ap(currentState(), 'actor')).toBe(6000);
  });

  it(`${QA.turnExpiry}: AP and grant survive contact but both expire at the public turn boundary`, () => {
    install(baseState());
    useB06042On('actor');
    expect(readChar.ap(currentState(), 'actor')).toBe(6000);
    expect(currentState().players.self.scene[0]?.turnEffects.grantedAbilities)
      .toEqual([expect.objectContaining({ id: GRANTED_ID })]);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'actor', abilId: GRANTED_ID }))
      .toEqual({ ok: true });
    resolveCurrentPick('target-1');
    const contactId = useGameStateStore.getState().activeActionId;
    expect(contactId).toBeTruthy();
    driveContactToEnd(contactId!);
    expect(readChar.ap(currentState(), 'actor')).toBe(6000);
    expect(currentState().players.self.scene[0]?.turnEffects.grantedAbilities)
      .toEqual([expect.objectContaining({ id: GRANTED_ID })]);

    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(currentState().turn.player).toBe('opp');
    expect(readChar.ap(currentState(), 'actor')).toBe(5000);
    expect(currentState().players.self.scene[0]?.turnEffects.grantedAbilities).toBeUndefined();

    expect(dispatchEngineAction({ type: 'endTurn', player: 'opp' })).toEqual({ ok: true });
    expect(currentState().turn.player).toBe('self');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'actor', abilId: GRANTED_ID }))
      .toEqual({ ok: false, reason: 'not-allowed' });

    resetHarness();
    install(baseState());
    useB06042On(null);
    expect(readChar.ap(currentState(), 'actor')).toBe(5000);
    expect(currentState().players.self.scene[0]?.turnEffects.grantedAbilities).toBeUndefined();
  });
});
