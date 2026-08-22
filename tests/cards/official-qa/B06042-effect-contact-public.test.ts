// qa: card:B06042:51624536ab2df37b3ce09f45df7c715d9ac3c8bbb64d8ff36ed28ebcc48829d5
// qa: card:B06042:4545d6c4d0f43af0c3ae464b0fa9dd1073ba6e5c27841d1ada4eafbe18fda5cc
// qa: card:B06042:79fac5486ce6718302ee32c449ad60e668c71588f9786bd02f695e6ffca24627
// qa: card:B06042:9c93e1cd153684d8dccf12f8b406d4c650b41109d4b7cb68ed65519d8679f803
// qa: card:B06042:c673aeb0bafea8865ce1c3fce36b934d492e7ea3b425511fa2786c1775a8e323
// qa: card:B06042:e669c73aabe5bbd89df0a1ad0d76f94ec6cba1d276b1565f5fa9c09b5d3bd949

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B06042 } from '@/cards/ct-p06/B06042';
import { D01009 } from '@/cards/ct-d01/D01009';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow/index.js';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = {
  fullContact: 'card:B06042:51624536ab2df37b3ce09f45df7c715d9ac3c8bbb64d8ff36ed28ebcc48829d5',
  noGuard: 'card:B06042:4545d6c4d0f43af0c3ae464b0fa9dd1073ba6e5c27841d1ada4eafbe18fda5cc',
  targetAuthority: 'card:B06042:79fac5486ce6718302ee32c449ad60e668c71588f9786bd02f695e6ffca24627',
  actorPosture: 'card:B06042:9c93e1cd153684d8dccf12f8b406d4c650b41109d4b7cb68ed65519d8679f803',
  contactHook: 'card:B06042:c673aeb0bafea8865ce1c3fce36b934d492e7ea3b425511fa2786c1775a8e323',
  notAnAction: 'card:B06042:e669c73aabe5bbd89df0a1ad0d76f94ec6cba1d276b1565f5fa9c09b5d3bd949',
} as const;

const GRANTED_ID = 'b06042_granted_contact';
const ACTOR = 'B06042_ACTOR';
const TARGET = 'B06042_TARGET';
const PROTECTED = 'B06042_PROTECTED';
const GUARDER = 'B06042_GUARDER';
const FILLER = 'B06042_FILLER';

function character(id: string, ap: number, abilities: AbilityDef[] = []): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: [...B06042.colors],
    level: 1,
    ap,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities,
    ruleRefs: [],
  };
}

const ACTOR_DEF = character(ACTOR, 5000);
const TARGET_DEF = character(TARGET, 1000);
const PROTECTED_DEF = character(PROTECTED, 2000, [{
  id: 'protected',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: { untargetableByOppEffect: true },
  description: 'opponent effect protection',
  ruleRefs: [],
}]);
const GUARDER_DEF = character(GUARDER, 3000);
const FILLER_DEF = character(FILLER, 1000);

type Hook =
  | 'action:declare'
  | 'action:guard-window'
  | 'action:guarded'
  | 'action:unguarded'
  | 'contact:start'
  | 'contact:end'
  | 'action:end';

function hookCounter(): Record<Hook, number> {
  const counts = {
    'action:declare': 0,
    'action:guard-window': 0,
    'action:guarded': 0,
    'action:unguarded': 0,
    'contact:start': 0,
    'contact:end': 0,
    'action:end': 0,
  } satisfies Record<Hook, number>;
  for (const hook of Object.keys(counts) as Hook[]) {
    event.on(hook, () => { counts[hook] += 1; });
  }
  return counts;
}

function scene(cardId: string, uid: string, state: 'active' | 'sleep' = 'active') {
  return makeChar({ cardId, uid, state });
}

function baseState(options: {
  targetState?: 'active' | 'sleep';
  includeProtected?: boolean;
  includeGuarder?: boolean;
  includeCutIn?: boolean;
} = {}): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...B06042.colors];
  state.players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  state.players.self.hand = [B06042.id, ...(options.includeCutIn ? [D01009.id] : [])];
  state.players.self.deck = [FILLER, FILLER, FILLER];
  state.players.opp.deck = [FILLER, FILLER, FILLER];
  state.players.self.scene = [scene(ACTOR, 'actor')];
  state.players.opp.scene = [scene(TARGET, 'target', options.targetState ?? 'active')];
  if (options.includeProtected) state.players.opp.scene.push(scene(PROTECTED, 'protected'));
  if (options.includeGuarder) state.players.opp.scene.push(scene(GUARDER, 'guarder'));
  return state;
}

function install(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function currentState(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function actionContext(actionId: string) {
  return flow.action._getContext(currentState(), actionId);
}

function grantContactAbility(state: GameState): void {
  install(state);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B06042.id }))
    .toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.source).toMatchObject({ cardId: B06042.id, abilityId: 'a1' });
  expect(pick?.candidates.map((candidate) => candidate.uid)).toContain('actor');
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve',
    pickedUid: 'actor',
  }))).toEqual({ ok: true });
  expect(readChar.ap(currentState(), 'actor')).toBe(6000);
  expect(currentState().players.self.scene[0]?.turnEffects.grantedAbilities)
    .toEqual([expect.objectContaining({ id: GRANTED_ID, type: 'declared' })]);
}

function declareGrantedAbility() {
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'actor', abilId: GRANTED_ID }))
    .toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.source).toMatchObject({ uid: 'actor', abilityId: GRANTED_ID });
  return pick!;
}

function resolveTarget(pickedUid: string | null): void {
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve',
    pickedUid,
  }))).toEqual({ ok: true });
}

function ownerOf(uid: string): Player {
  return currentState().players.self.scene.some((card) => card.uid === uid) ? 'self' : 'opp';
}

function driveContactToEnd(actionId: string, useCutIn = false): void {
  let cutInUsed = false;
  for (let step = 0; step < 15; step += 1) {
    const context = actionContext(actionId);
    if (!context) return;
    if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
      const actingUid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      const player = ownerOf(actingUid!);
      const shouldCutIn = useCutIn && player === 'self' && !cutInUsed;
      expect(dispatchEngineAction({
        type: 'actionContact',
        actionId,
        player,
        choice: shouldCutIn ? { kind: 'cutin', cardId: D01009.id } : { kind: 'pass' },
      })).toEqual({ ok: true });
      if (shouldCutIn) {
        // The public cut-in choice is the optional-use decision itself. Its
        // selected effect resolves in the same dispatch; no second prompt is created.
        expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
        expect(readChar.ap(currentState(), 'actor')).toBe(7000);
        cutInUsed = true;
      }
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

function resetHarness(): void {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  for (const card of [B06042, D01009, ACTOR_DEF, TARGET_DEF, PROTECTED_DEF, GUARDER_DEF, FILLER_DEF]) {
    register(card);
  }
  registerTriggeredListener();
  beginMatchSession('self');
}

beforeEach(() => resetHarness());

afterEach(() => endMatchSession());

describe('B06042 public effect-generated contact', () => {
  it(`${QA.fullContact}: selected target completes contact while declining creates no contact`, () => {
    const hooks = hookCounter();
    grantContactAbility(baseState({ includeCutIn: true }));
    const pick = declareGrantedAbility();
    expect(pick.candidates.map((candidate) => candidate.uid)).toEqual(['target']);
    resolveTarget('target');

    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    expect(actionContext(actionId!)).toMatchObject({
      byUid: 'actor',
      phase: 'action-1',
      generatedByEffect: true,
      target: { kind: 'char', uid: 'target' },
    });
    expect(currentState().log.filter((entry) => entry.action === 'effect:startContact'))
      .toEqual([expect.objectContaining({ target: 'target' })]);

    driveContactToEnd(actionId!, true);

    expect(currentState().players.opp.scene).toHaveLength(0);
    expect(currentState().players.opp.remove).toContain(TARGET);
    expect(readChar.ap(currentState(), 'actor')).toBe(6000);
    expect(hooks['contact:start']).toBe(1);
    expect(hooks['contact:end']).toBe(1);

    resetHarness();
    const declineHooks = hookCounter();
    grantContactAbility(baseState());
    declareGrantedAbility();
    resolveTarget(null);

    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(currentState().log.filter((entry) => entry.action === 'effect:startContact')).toHaveLength(0);
    expect(declineHooks['contact:start']).toBe(0);
    expect(declineHooks['contact:end']).toBe(0);
    expect(currentState().players.opp.scene.map((card) => card.uid)).toEqual(['target']);
  });

  it('effect-generated contact ends before order and judge when contact:start removes both participants', () => {
    register(character(ACTOR, 5000, [{
      id: 'remove-contact-participants',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'contact:start', selfOnly: true },
      effect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'sceneRemove', args: { uid: '$contact.targetUid', cause: 'effect' } },
          { kind: 'atom', verb: 'sceneRemove', args: { uid: '$contact.byUid', cause: 'effect' } },
        ],
      },
      description: 'Effect-contact participant removal fixture.',
      ruleRefs: ['rules/08-contact.md'],
    }]));
    const hooks = hookCounter();
    let orderSetCount = 0;
    let beforeJudgeCount = 0;
    let judgeCount = 0;
    event.on('contact:order-set', () => { orderSetCount += 1; });
    event.on('contact:before-judge', () => { beforeJudgeCount += 1; });
    event.on('contact:judge', () => { judgeCount += 1; });

    grantContactAbility(baseState());
    declareGrantedAbility();
    resolveTarget('target');

    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    expect(actionContext(actionId!)).toMatchObject({
      phase: 'contact-end',
      generatedByEffect: true,
    });
    expect(currentState().players.self.scene.some((card) => card.uid === 'actor')).toBe(false);
    expect(currentState().players.opp.scene.some((card) => card.uid === 'target')).toBe(false);
    expect(orderSetCount).toBe(0);
    expect(beforeJudgeCount).toBe(0);
    expect(judgeCount).toBe(0);
    expect(hooks['contact:start']).toBe(1);
    expect(hooks['contact:end']).toBe(1);
    expect(hooks['action:end']).toBe(0);

    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(actionContext(actionId!)).toBeUndefined();
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(hooks['contact:end']).toBe(1);
    expect(hooks['action:end']).toBe(0);
  });

  it(`${QA.noGuard}: effect contact skips guard selection and all guard hooks`, () => {
    const hooks = hookCounter();
    grantContactAbility(baseState({ includeGuarder: true }));
    declareGrantedAbility();
    resolveTarget('target');
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();

    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: 'guarder' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(currentState().players.self.scene[0]?.state).toBe('active');
    expect(currentState().players.opp.scene.find((card) => card.uid === 'guarder')?.state).toBe('active');
    expect(hooks['action:guard-window']).toBe(0);
    expect(hooks['action:guarded']).toBe(0);
    expect(hooks['action:unguarded']).toBe(0);
  });

  it(`${QA.targetAuthority}: only live unprotected opposing scene targets are admitted`, () => {
    grantContactAbility(baseState({ includeProtected: true }));
    const pick = declareGrantedAbility();
    expect(pick.candidates.map((candidate) => candidate.uid)).toEqual(['target']);

    for (const pickedUid of ['actor', 'protected', 'off-scene']) {
      expect(dispatchEngineAction(bindPendingDecision(pick, {
        type: 'effectPickResolve',
        pickedUid,
      }))).toEqual({ ok: false, reason: 'not-allowed' });
      expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(pick.decisionId);
      expect(useGameStateStore.getState().activeActionId).toBeNull();
    }

    const withoutTarget = structuredClone(currentState());
    withoutTarget.players.opp.scene = withoutTarget.players.opp.scene.filter((card) => card.uid !== 'target');
    install(withoutTarget);
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve',
      pickedUid: 'target',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(currentState().log.filter((entry) => entry.action === 'effect:startContact')).toHaveLength(0);
  });

  it(`${QA.actorPosture}: effect contact keeps the actor active while a normal action sleeps it`, () => {
    grantContactAbility(baseState());
    declareGrantedAbility();
    resolveTarget('target');
    expect(currentState().players.self.scene[0]).toMatchObject({
      uid: 'actor',
      state: 'active',
      turnEffects: expect.not.objectContaining({ actedCharThisTurn: true }),
    });

    resetHarness();
    install(baseState({ targetState: 'sleep' }));
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    expect(currentState().players.self.scene[0]).toMatchObject({
      uid: 'actor',
      state: 'sleep',
      turnEffects: expect.objectContaining({ actedCharThisTurn: true }),
    });
  });

  it(`${QA.contactHook}: selected target emits one contact start while decline emits none`, () => {
    const selectedHooks = hookCounter();
    grantContactAbility(baseState());
    declareGrantedAbility();
    resolveTarget('target');
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    driveContactToEnd(actionId!);
    expect(selectedHooks['contact:start']).toBe(1);
    expect(selectedHooks['contact:end']).toBe(1);

    resetHarness();
    const declineHooks = hookCounter();
    grantContactAbility(baseState());
    declareGrantedAbility();
    resolveTarget(null);
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(declineHooks['contact:start']).toBe(0);
    expect(declineHooks['contact:end']).toBe(0);
  });

  it(`${QA.notAnAction}: effect contact emits contact hooks but no normal-action hooks or accounting`, () => {
    const hooks = hookCounter();
    grantContactAbility(baseState());
    declareGrantedAbility();
    resolveTarget('target');
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    driveContactToEnd(actionId!);

    expect(currentState().players.self.scene[0]).toMatchObject({
      uid: 'actor',
      state: 'active',
      turnEffects: expect.not.objectContaining({ actedCharThisTurn: true }),
    });
    expect(hooks).toEqual({
      'action:declare': 0,
      'action:guard-window': 0,
      'action:guarded': 0,
      'action:unguarded': 0,
      'contact:start': 1,
      'contact:end': 1,
      'action:end': 0,
    });
  });

  it('normal action control emits the ordinary guard and action-end hooks', () => {
    const hooks = hookCounter();
    install(baseState({ targetState: 'sleep' }));
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    expect(hooks['action:declare']).toBe(1);
    expect(hooks['action:guard-window']).toBe(1);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null }))
      .toEqual({ ok: true });
    expect(hooks['action:unguarded']).toBe(1);
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    driveContactToEnd(actionId!);
    expect(hooks['contact:start']).toBe(1);
    expect(hooks['contact:end']).toBe(1);
    expect(hooks['action:end']).toBe(1);
  });
});
