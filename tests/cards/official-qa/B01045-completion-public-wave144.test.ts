// qa: card:B01045:05863fa35054fd302da46dd33e377bfdcf15c8eb2fd6e3ba5d2ec04f14008de8
// qa: card:B01045:67e48101524134bb360745031bc16d06ca2c3b9b2a76204fcd9d98a9387d7b7a
// qa: card:B01045:858dc09931955bdefd677b43229bc27e02ac217b2c459527d0f450a23a404a1b
// qa: card:B01045:ef2f7279fad2c376c17069fa358b80622e78a7a8222426a8340682e58c6dec80

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B01045 } from '@/cards/ct-p01/B01045';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetMisreadRegistered, _resetPendingMisread, registerMisreadListener } from '@/engine/listeners/misread';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'], level: 2,
    ap: 4000, lp: 3, traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const REASONER = fixture('W144_REASONER');
const SECOND_REASONER = fixture('W144_SECOND_REASONER', { ap: 5000, lp: 2 });
const ACTIONER = fixture('W144_ACTIONER', { ap: 5000, lp: 1 });
const TARGET = fixture('W144_TARGET', { ap: 1000, lp: 1 });
const TAIL = fixture('W144_TAIL');
const OWNERS = ['self', 'opp'] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave144 state');
  return state;
}

function board(owner: Player): GameState {
  const opponent = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 45, player: opponent, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(B01045.id, 'aoko')];
  state.players[owner].deck = Array.from({ length: 7 }, () => TAIL.id);
  state.players[opponent].deck = Array.from({ length: 5 }, () => TAIL.id);
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave144-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function optional(owner: Player) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({ player: owner, source: { uid: 'aoko', cardId: B01045.id, abilityId: 'a2' } });
  return pending!;
}

function resolveOptional(owner: Player, run: boolean): void {
  const pending = optional(owner);
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
}

function skipMisread(): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingMisread;
  if (!pending) return;
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'misreadResolve', picks: [],
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  _resetPendingMisread();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetMisreadRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [REASONER, SECOND_REASONER, ACTIONER, TARGET, TAIL]) register(card);
  registerMisreadListener();
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetPendingMisread();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave144: original AP/LP overrides retain other modifiers', () => {
  it.each(OWNERS)('owner %s', owner => {
    const opponent = other(owner);
    const state = board(owner);
    state.players[opponent].scene = [sceneChar(REASONER.id, 'reasoner')];
    mutate.char.modifyLP(state, 'reasoner', 2, 'turn');
    mutate.char.modifyAP(state, 'reasoner', 1000, 'turn');
    install(state, owner, `${owner}-modifiers`);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    resolveOptional(owner, true);
    expect(readChar.lp(current(), 'reasoner')).toBe(2);
    expect(readChar.ap(current(), 'reasoner')).toBe(1000);
    expect(current().players[owner].remove).toHaveLength(5);
  });
});

describe('official QA Wave144: AP zero never removes the character', () => {
  it.each(OWNERS)('owner %s', owner => {
    const opponent = other(owner);
    const state = board(owner);
    state.players[opponent].scene = [sceneChar(REASONER.id, 'reasoner')];
    install(state, owner, `${owner}-ap-zero`);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    resolveOptional(owner, true);
    expect(readChar.ap(current(), 'reasoner')).toBe(0);
    expect(current().players[opponent].scene.some(character => character.uid === 'reasoner')).toBe(true);
  });
});

describe('official QA Wave144: reaction opens immediately after sleep and before Misread', () => {
  it.each(OWNERS)('owner %s', owner => {
    const opponent = other(owner);
    const state = board(owner);
    state.players[opponent].scene = [sceneChar(REASONER.id, 'reasoner')];
    install(state, owner, `${owner}-reasoning-timing`);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    expect(current().players[opponent].scene.find(character => character.uid === 'reasoner')?.state).toBe('sleep');
    expect(current().players[opponent].evidence).toHaveLength(0);
    expect(useGameStateStore.getState().pendingMisread).toBeNull();
    optional(owner);
  });

  it.each(OWNERS)('owner %s opens before guard choice', owner => {
    const opponent = other(owner);
    const state = board(owner);
    state.players[owner].scene.push(sceneChar(TARGET.id, 'target', { state: 'sleep' }));
    state.players[opponent].scene = [sceneChar(ACTIONER.id, 'actioner')];
    install(state, owner, `${owner}-action-timing`);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actioner', targetUid: 'target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    optional(owner);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    resolveOptional(owner, false);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  });
});

describe('official QA Wave144: declining the mill still consumes Turn1', () => {
  it.each(OWNERS)('owner %s', owner => {
    const opponent = other(owner);
    const state = board(owner);
    state.players[opponent].scene = [
      sceneChar(REASONER.id, 'first-reasoner'),
      sceneChar(SECOND_REASONER.id, 'second-reasoner'),
    ];
    install(state, owner, `${owner}-turn1-decline`);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'first-reasoner' })).toEqual({ ok: true });
    resolveOptional(owner, false);
    skipMisread();
    expect(dispatchEngineAction({ type: 'reasoning', uid: 'second-reasoner' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(current().players[owner].deck).toHaveLength(7);
  });
});
