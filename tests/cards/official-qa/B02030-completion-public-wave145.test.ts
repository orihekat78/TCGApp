// qa: card:B02030:22477398ef5d506ba40697a07f730240d929ade78c8a7edaa6aeed9aeb97b358
// qa: card:B02030:39a9ed43f1877d193b71a9d59932b1ea21e0caa245c021c884bcb0bd7a3f0bf9
// qa: card:B02030:aa20aec7b73ca4b3302fc361b08b34f089f650599212db9bf7d7574d04c049dc
// qa: card:B02030:d2129671c0cc74c9289574e72c7fcf22be8dea59430d9991e2643e15485bc8d5

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02030 } from '@/cards/ct-p02/B02030';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { contact as contactFlow } from '@/engine/flow';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { startCausalSession } from '@/engine/log/causal';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, ActionContext, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], level: 2,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const cutin = (id: string, delta: number): CardDef => fixture(id, {
  abilities: [{
    id: 'cutin', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta, scope: 'contact' } },
    description: `Cut-In AP+${delta}`, ruleRefs: ['rules/09-cutin-disguise.md'],
  }],
});
const USER_CUTIN = cutin('W145-USER-CUTIN', 2000);
const USER_SECOND_CUTIN = cutin('W145-USER-SECOND-CUTIN', 1000);
const OWNER_CUTIN = cutin('W145-OWNER-CUTIN', 1000);
const DISGUISE = fixture('W145-DISGUISE', {
  abilities: [{
    id: 'disguise', type: 'icon-disguise',
    description: 'Wave145 disguise.', ruleRefs: ['rules/09-cutin-disguise.md'],
  } as AbilityDef],
});
const USER_CHAR = fixture('W145-USER-CHAR', { ap: 1000 });
const OWNER_CHAR = fixture('W145-OWNER-CHAR', { ap: 5000 });
const HOST_A = fixture('W145-HOST-A');
const HOST_B = fixture('W145-HOST-B');
const SET_A = fixture('W145-SET-A', { kind: 'event', ap: undefined, lp: undefined });
const SET_B = fixture('W145-SET-B', { kind: 'event', ap: undefined, lp: undefined });
const TAIL = fixture('W145-TAIL');
const OWNERS = ['self', 'opp'] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave145 state');
  return state;
}

function actionContext(actionId: string): ActionContext {
  const action = current().actionContexts?.[actionId];
  if (!action) throw new Error(`missing Wave145 action ${actionId}`);
  return action;
}

function board(owner: Player, setCount = 2): GameState {
  const user = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 47, player: user, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[user].scene = [sceneChar(USER_CHAR.id, 'user-char')];
  state.players[user].hand = [USER_CUTIN.id, USER_SECOND_CUTIN.id, DISGUISE.id];
  state.players[owner].scene = [
    sceneChar(B02030.id, 'heizo'),
    sceneChar(OWNER_CHAR.id, 'owner-char', { state: 'sleep' }),
    sceneChar(HOST_A.id, 'host-a', {
      setCards: setCount >= 1 ? [{ cardId: SET_A.id, faceUp: false, instanceId: 'set:a' }] : [],
    }),
    sceneChar(HOST_B.id, 'host-b', {
      setCards: setCount >= 2 ? [{ cardId: SET_B.id, faceUp: false, instanceId: 'set:b' }] : [],
    }),
  ];
  state.players[owner].hand = [OWNER_CUTIN.id];
  state.players[user].deck = [TAIL.id, TAIL.id];
  state.players[owner].deck = [TAIL.id, TAIL.id];
  return state;
}

function install(state: GameState, owner: Player, label: string, human: Player = owner): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  const sessionId = `qa-wave145-${label}`;
  startCausalSession(state, sessionId);
  resetPresentationQueue(sessionId);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function reachFirstWindow(owner: Player): string {
  const user = other(owner);
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'user-char', targetUid: 'owner-char' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 8; step += 1) {
    const action = actionContext(actionId);
    if (action.phase === 'action-1') {
      expect(action.firstUid).toBe('user-char');
      expect(current().players[user].scene.some(character => character.uid === action.firstUid)).toBe(true);
      return actionId;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave145 did not reach first contact action');
}

function useOpponentCutin(owner: Player, actionId: string): void {
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: other(owner),
    choice: { kind: 'cutin', cardId: USER_CUTIN.id },
  })).toEqual({ ok: true });
  surfacePendingSideChannels();
}

function acceptNegate(owner: Player): void {
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional).toMatchObject({ player: owner, source: { uid: 'heizo', cardId: B02030.id, abilityId: 'a1' } });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [USER_CUTIN, USER_SECOND_CUTIN, OWNER_CUTIN, DISGUISE, USER_CHAR, OWNER_CHAR, HOST_A, HOST_B, SET_A, SET_B, TAIL]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave145: Cut-In negation is an immediate two-set-card reaction', () => {
  it('ships the missing printed ability as a serializable immediate negate descriptor', () => {
    expect(B02030.abilities[0]).toMatchObject({
      id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'cutin:used' },
      effect: { kind: 'optional' },
    });
    expect(JSON.parse(JSON.stringify(B02030.abilities[0]))).toBeTruthy();
  });

  it.each(OWNERS)('owner %s nullifies the effect and preserves contact action order', owner => {
    const user = other(owner);
    install(board(owner), owner, `${owner}-negate`);
    const actionId = reachFirstWindow(owner);

    useOpponentCutin(owner, actionId);
    expect(current().players[user].remove).toContain(USER_CUTIN.id);
    expect(readChar.ap(current(), 'user-char')).toBe(1000);
    const immediate = current().pendingEffects.find(entry =>
      entry.source.cardId === B02030.id && entry.source.abilityId === 'a1');
    expect(immediate).toMatchObject({ immediateDeclaredReaction: true, state: 'resolved' });
    const roundTripped = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(roundTripped, { preserveRuntime: true })).toBe(true);
    expect(current().pendingEffects.find(entry => entry.id === immediate?.id))
      .toMatchObject({ immediateDeclaredReaction: true });
    acceptNegate(owner);

    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick).toMatchObject({ player: owner, atomVerb: 'charRemoveSetCard', nMin: 2, nMax: 2 });
    expect(pick?.candidates.map(candidate => candidate.hostUid)).toEqual(['host-a', 'host-b']);
    const pickedUids = pick!.candidates.map(candidate => candidate.uid);
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: pickedUids[0]!, pickedUids,
    }))).toEqual({ ok: true });

    expect(current().players[owner].scene.find(character => character.uid === 'host-a')?.setCards).toEqual([]);
    expect(current().players[owner].scene.find(character => character.uid === 'host-b')?.setCards).toEqual([]);
    expect(current().players[owner].remove).toEqual(expect.arrayContaining([SET_A.id, SET_B.id]));
    expect(readChar.ap(current(), 'user-char')).toBe(1000);
    expect(current().pendingEffects.some(entry =>
      entry.source.cardId === USER_CUTIN.id && entry.state === 'cancelled')).toBe(true);
    expect(current().log.some(entry =>
      'schemaVersion' in entry
      && entry.kind === 'negate'
      && entry.tags?.includes('cutin')
      && entry.outcome.type === 'state'
      && entry.outcome.state === 'negated')).toBe(true);

    const action = actionContext(actionId);
    expect(action.phase).toBe('action-1');
    expect(action.firstActed).toBe(true);
    expect(contactFlow.canCutIn(current(), action, user, USER_SECOND_CUTIN.id)).toBe(false);
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(actionContext(actionId).phase).toBe('action-2');
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: owner,
      choice: { kind: 'cutin', cardId: OWNER_CUTIN.id },
    })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(actionContext(actionId).phase).toBe('judge');
  });

  it.each(OWNERS)('owner %s does not react to disguise', owner => {
    install(board(owner), owner, `${owner}-disguise`);
    const actionId = reachFirstWindow(owner);
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: other(owner),
      choice: { kind: 'disguise', cardId: DISGUISE.id },
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(current().players[owner].scene.flatMap(character => character.setCards)).toHaveLength(2);
  });

  it('cannot negate when fewer than two set-card occurrences exist', () => {
    const owner = 'opp' as const;
    install(board(owner, 1), owner, 'insufficient-set-cards');
    const actionId = reachFirstWindow(owner);
    useOpponentCutin(owner, actionId);
    acceptNegate(owner);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(readChar.ap(current(), 'user-char')).toBe(3000);
    expect(current().players[owner].scene.find(character => character.uid === 'host-a')?.setCards).toHaveLength(1);
  });

  it.each(OWNERS)('owner %s may decline without spending set cards', owner => {
    install(board(owner), owner, `${owner}-decline`);
    const actionId = reachFirstWindow(owner);
    useOpponentCutin(owner, actionId);
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(dispatchEngineAction(bindPendingDecision(optional!, {
      type: 'optionalResolve', run: false,
    }))).toEqual({ ok: true });

    expect(readChar.ap(current(), 'user-char')).toBe(3000);
    expect(current().players[owner].scene.flatMap(character => character.setCards)).toHaveLength(2);
    expect(current().pendingEffects.some(entry =>
      entry.source.cardId === USER_CUTIN.id && entry.state === 'resolved')).toBe(true);
  });

  it('removes two exact occurrences from the same host before negating', () => {
    const owner = 'opp' as const;
    const state = board(owner);
    const hostA = state.players[owner].scene.find(character => character.uid === 'host-a')!;
    const hostB = state.players[owner].scene.find(character => character.uid === 'host-b')!;
    hostA.setCards.push(...hostB.setCards);
    hostB.setCards = [];
    install(state, owner, 'same-host');
    const actionId = reachFirstWindow(owner);
    useOpponentCutin(owner, actionId);
    acceptNegate(owner);

    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick.candidates.map(candidate => candidate.hostUid)).toEqual(['host-a', 'host-a']);
    const pickedUids = pick.candidates.map(candidate => candidate.uid);
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: pickedUids[0]!, pickedUids,
    }))).toEqual({ ok: true });
    expect(current().players[owner].scene.find(character => character.uid === 'host-a')?.setCards).toEqual([]);
    expect(readChar.ap(current(), 'user-char')).toBe(1000);
  });

  it('cold-restores the immediate optional authority from JSON', () => {
    const owner = 'opp' as const;
    install(board(owner), owner, 'cold-restore');
    const actionId = reachFirstWindow(owner);
    useOpponentCutin(owner, actionId);
    const saved = JSON.parse(JSON.stringify(current())) as GameState;

    useGameStateStore.getState().resetMatchSessionState();
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional).toMatchObject({
      player: owner, source: { cardId: B02030.id, abilityId: 'a1' },
    });
    expect(current().pendingEffects.some(entry => entry.immediateDeclaredReaction === true)).toBe(true);
  });

  it.each(OWNERS)('CPU owner %s resolves the exact-two reaction autonomously', owner => {
    const user = other(owner);
    install(board(owner), owner, `${owner}-cpu-negate`, user);
    const actionId = reachFirstWindow(owner);
    useOpponentCutin(owner, actionId);

    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players[owner].scene.find(character => character.uid === 'host-a')?.setCards).toEqual([]);
    expect(current().players[owner].scene.find(character => character.uid === 'host-b')?.setCards).toEqual([]);
    expect(readChar.ap(current(), 'user-char')).toBe(1000);
    expect(current().pendingEffects.some(entry =>
      entry.source.cardId === USER_CUTIN.id && entry.state === 'cancelled')).toBe(true);
  });
});
