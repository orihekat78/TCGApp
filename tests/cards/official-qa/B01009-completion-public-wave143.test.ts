// qa: card:B01009:2ca5b478df684d0944e74fceb7664125a59a6e2a239ae9323d3477e04506cf07
// qa: card:B01009:9b35da4fb6ed8aa62d54a57747cf2b31522347729a78580f7e98cf5539e5d455
// qa: card:B01009:eee7f80e75bd8abebe536238f02477e2a85687c6e7831056e13e58dc4f76389c
// qa: card:B01009:f9d4fa8587cf380f15b87d0c08fe628abd77c032a533c1e631434f3129693416

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { misreadX } from '@/cards/_shared/misreadX';
import { B01009 } from '@/cards/ct-p01/B01009';
import { B01009P } from '@/cards/ct-p01/B01009P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetMisreadRegistered, _resetPendingMisread, registerMisreadListener } from '@/engine/listeners/misread';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { ActionContext, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['青'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const BLUE_ZERO = fixture('W143_BLUE_ZERO', { lp: 0 });
const BOOSTED_ZERO = fixture('W143_BOOSTED_ZERO', { lp: 0 });
const BLUE_ONE = fixture('W143_BLUE_ONE', { lp: 1 });
const RED_ZERO = fixture('W143_RED_ZERO', { colors: ['赤'], lp: 0 });
const ACTIONER = fixture('W143_ACTIONER', { level: 7, ap: 9000, lp: 0 });
const TARGET_ONE = fixture('W143_TARGET_ONE', { ap: 1000 });
const TARGET_TWO = fixture('W143_TARGET_TWO', { ap: 2000 });
const MISREAD = fixture('W143_MISREAD', { abilities: [misreadX({ x: 1, abilityId: 'misread' })] });
const TAIL = fixture('W143_TAIL');
const PRINTINGS = [B01009, B01009P] as const;
const PRINTING_OWNERS = PRINTINGS.flatMap(printing =>
  (['self', 'opp'] as const).map(owner => ({ printing, owner })));

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave143 state');
  return state;
}

function actionContext(actionId: string): ActionContext {
  const action = current().actionContexts?.[actionId];
  if (!action) throw new Error(`missing Wave143 action ${actionId}`);
  return action;
}

function board(printing: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 43, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(printing.id, 'source')];
  state.players[owner].deck = [TAIL.id, TAIL.id];
  state.players[other(owner)].deck = [TAIL.id, TAIL.id];
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave143-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function declare(printing: CardDef): NonNullable<ReturnType<typeof pendingPick>> {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
  })).toEqual({ ok: true });
  const pick = pendingPick();
  expect(current().players.self.scene.concat(current().players.opp.scene).some(character => character.uid === 'source'))
    .toBe(false);
  expect(current().players.self.deck.concat(current().players.opp.deck)).toContain(printing.id);
  return pick;
}

function pendingPick() {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.atomVerb).toBe('sceneSetState');
  return pick!;
}

function choose(pick: NonNullable<ReturnType<typeof pendingPick>>, uid: string): void {
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function finishAction(actionId: string, owner: Player): void {
  for (let step = 0; step < 24 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    const action = actionContext(actionId);
    if (action.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    }
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players[owner].scene.some(character => character.uid === actingUid)
        ? owner
        : other(owner);
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).not.toBe(actionId);
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
  for (const card of [BLUE_ZERO, BOOSTED_ZERO, BLUE_ONE, RED_ZERO, ACTIONER, TARGET_ONE, TARGET_TWO, MISREAD, TAIL]) register(card);
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

describe('official QA Wave143: declared targeting uses effective LP and stun activation becomes sleep', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner', ({ printing, owner }) => {
    const state = board(printing, owner);
    const boosted = sceneChar(BOOSTED_ZERO.id, 'boosted', { state: 'sleep' });
    boosted.turnEffects.lpMod_turn = 1;
    state.players[owner].scene.push(boosted, sceneChar(RED_ZERO.id, 'red-zero', { state: 'sleep' }));
    state.players[other(owner)].scene = [sceneChar(BLUE_ZERO.id, 'stunned-zero', { state: 'stun' })];
    install(state, owner, `${printing.id}-${owner}-effective-lp-stun`);

    expect(readChar.lp(current(), 'boosted')).toBe(1);
    const pick = declare(printing);
    expect(pick.candidates.map(candidate => candidate.uid)).toEqual(['stunned-zero']);
    choose(pick, 'stunned-zero');
    expect(current().players[other(owner)].scene.find(character => character.uid === 'stunned-zero')?.state)
      .toBe('sleep');
  });
});

describe('official QA Wave143: Misread LP reduction expires before the declared ability can target', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner', ({ printing, owner }) => {
    const state = board(printing, owner);
    state.players[owner].scene.push(
      sceneChar(BLUE_ONE.id, 'reasoner'),
      sceneChar(BLUE_ZERO.id, 'valid-zero', { state: 'sleep' }),
    );
    state.players[other(owner)].scene = [sceneChar(MISREAD.id, 'misread')];
    install(state, owner, `${printing.id}-${owner}-misread-expiry`);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    expect(current().players[owner].scene.find(character => character.uid === 'reasoner')?.state).toBe('sleep');
    expect(readChar.lp(current(), 'reasoner')).toBe(1);
    expect(current().players[owner].evidence).toHaveLength(0);

    const pick = declare(printing);
    expect(pick.candidates.map(candidate => candidate.uid)).toContain('valid-zero');
    expect(pick.candidates.map(candidate => candidate.uid)).not.toContain('reasoner');
  });
});

describe('official QA Wave143: reactivation permits another action in the same turn', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner', ({ printing, owner }) => {
    const state = board(printing, owner);
    state.players[owner].scene.push(sceneChar(ACTIONER.id, 'actioner'));
    state.players[other(owner)].scene = [
      sceneChar(TARGET_ONE.id, 'target-one', { state: 'sleep' }),
      sceneChar(TARGET_TWO.id, 'target-two', { state: 'sleep' }),
    ];
    install(state, owner, `${printing.id}-${owner}-repeat-action`);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actioner', targetUid: 'target-one' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    finishAction(actionId, owner);
    expect(current().players[owner].scene.find(character => character.uid === 'actioner')?.state).toBe('sleep');

    const pick = declare(printing);
    expect(pick.candidates.map(candidate => candidate.uid)).toContain('actioner');
    choose(pick, 'actioner');
    expect(current().players[owner].scene.find(character => character.uid === 'actioner')?.state).toBe('active');
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actioner', targetUid: 'target-two' }))
      .toEqual({ ok: true });
  });
});
