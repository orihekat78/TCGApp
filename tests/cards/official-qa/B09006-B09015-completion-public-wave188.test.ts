// qa: card:B09006:2d9f6416a9eff00283168d4c98abf4724ce62c0471c67384b312b1d17e6b5148
// qa: card:B09008:de2d797a1d0041c743397c6faf8a39a5ad13791802fd1df596c8c51e1472e8f4
// qa: card:B09009:5f731874760d0bc0135bb404f430aadf50517c003bcfdc74b170b4d678f9d2b7
// qa: card:B09010:0934ecf9bcc2302941e7e18dfb4e58d35df352461fdefac10abada5b74899744
// qa: card:B09011:1326a9294ee6a8f8fb160e25680fb9eadb1af57c1a38f516b058d52eecea0875
// qa: card:B09011:8c5daccdad59b584f3c540fc554a06d6632bc20167f6a138465dd77c29c85ef8
// qa: card:B09014:4ad5af7ab24f79591bd47d2a1c58869a17659d0eecad2ec611f5f0fbdb9b5120
// qa: card:B09015:f9e96c0a30ab3e5c108dee31fa4ad873a8ddcbd547e32c171cc07dfcbfbec112

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09006 } from '@/cards/ct-p09/B09006';
import { B09008 } from '@/cards/ct-p09/B09008';
import { B09009 } from '@/cards/ct-p09/B09009';
import { B09010 } from '@/cards/ct-p09/B09010';
import { B09011 } from '@/cards/ct-p09/B09011';
import { B09014 } from '@/cards/ct-p09/B09014';
import { B09015 } from '@/cards/ct-p09/B09015';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { flow } from '@/engine/flow';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
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

const ERI = fixture('W188_ERI', { names: ['妃英理'], level: 4, ap: 3000 });
const SLEEP_TARGET = fixture('W188_SLEEP_TARGET', { level: 7, ap: 7000 });
const SOCCER = fixture('W188_SOCCER', { traits: ['サッカー選手'], ap: 3000 });
const NON_SOCCER = fixture('W188_NON_SOCCER', { ap: 3000 });
const LP0 = fixture('W188_LP0', { traits: ['少年探偵団'], level: 4, lp: 0 });
const REVIVE_A = fixture('W188_REVIVE_A', { names: ['吉田歩美'], traits: ['少年探偵団'], level: 4 });
const REVIVE_B = fixture('W188_REVIVE_B', { names: ['円谷光彦'], traits: ['少年探偵団'], level: 4 });
const FILLER = fixture('W188_FILLER', { level: 3 });
const FILE_FILLER = fixture('W188_FILE_FILLER', { kind: 'event' });
const FILE_TOP = fixture('W188_FILE_TOP', { kind: 'event' });
const ATTACKER = fixture('W188_ATTACKER', { ap: 7000 });
const GUARD_ALLY = fixture('W188_GUARD_ALLY', { names: ['灰原哀'], traits: ['少年探偵団'], level: 4 });
const MITSUHIKO_L7 = fixture('W188_MITSUHIKO_L7', { names: ['円谷光彦'], level: 7 });
const SBD4 = fixture('W188_SBD4', { names: ['吉田歩美'], traits: ['少年探偵団'], level: 4 });
const SBD5 = fixture('W188_SBD5', { names: ['吉田歩美'], traits: ['少年探偵団'], level: 5 });

const FIXTURES = [
  ERI, SLEEP_TARGET, SOCCER, NON_SOCCER, LP0, REVIVE_A, REVIVE_B, FILLER,
  FILE_FILLER, FILE_TOP, ATTACKER, GUARD_ALLY, MITSUHIKO_L7, SBD4, SBD5,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave188 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave188-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, pickedUid: string | null, extra: Record<string, unknown> = {}): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid, ...extra,
  } as never))).toEqual({ ok: true });
}

function chooseCard(pending: PendingPick, cardId: string): void {
  const candidate = pending.candidates.find(item => item.cardId === cardId);
  expect(candidate, `${cardId} must be selectable`).toBeTruthy();
  choose(pending, candidate!.uid);
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  flow.action._resetActionContexts();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave188: independent optional steps', () => {
  it.each([
    ['self', false], ['self', true], ['opp', false], ['opp', true],
  ] as const)('owner=%s removeFirst=%s independently resolves B09006 choices', (owner, removeFirst) => {
    const state = createEmptyGameState();
    state.turn = { number: 188, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B09006.id, 'kogoro'),
      sceneChar(ERI.id, 'eri', { state: 'sleep' }),
    ];
    state.players[other(owner)].scene = [sceneChar(SLEEP_TARGET.id, 'sleep-target', { state: 'sleep' })];
    install(state, owner, `${owner}-B09006-${removeFirst}`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'kogoro', abilId: 'a1' })).toEqual({ ok: true });
    const removal = pendingPick(B09006.id, 'a1', 'sceneRemove');
    choose(removal, removeFirst ? 'sleep-target' : null);
    const activation = pendingPick(B09006.id, 'a1', 'sceneSetState');
    choose(activation, removeFirst ? null : 'eri');

    expect(current().players[owner].scene.find(card => card.uid === 'eri')?.state)
      .toBe(removeFirst ? 'sleep' : 'active');
    expect(current().players[other(owner)].remove.includes(SLEEP_TARGET.id)).toBe(removeFirst);
  });
});

describe('official QA Wave188: continuous abilities', () => {
  it.each(['self', 'opp'] as const)('owner=%s B09008 gains and loses Assault with effective AP', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 188, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B09008.id, 'hero')];
    mutate.char.modifyAP(state, 'hero', 1000, 'turn');
    expect(read.char.ap(state, 'hero'), B09008.id).toBe(6000);
    expect(read.char.keywords(state, 'hero')).toContain('突撃');
    mutate.char.modifyAP(state, 'hero', -1000, 'turn');
    expect(read.char.ap(state, 'hero')).toBe(5000);
    expect(read.char.keywords(state, 'hero')).not.toContain('突撃');
    expect(state.pendingEffects).toEqual([]);
  });

  it.each(['self', 'opp'] as const)('owner=%s B09009 buffs every own soccer player continuously', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 188, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B09009.id, 'aura'), sceneChar(SOCCER.id, 'soccer'), sceneChar(NON_SOCCER.id, 'other'),
    ];
    state.players[other(owner)].scene = [sceneChar(SOCCER.id, 'opponent-soccer')];
    expect(read.char.ap(state, 'soccer'), B09009.id).toBe(4000);
    expect(read.char.ap(state, 'other')).toBe(3000);
    expect(read.char.ap(state, 'opponent-soccer')).toBe(3000);
    state.turn.player = other(owner);
    expect(read.char.ap(state, 'soccer')).toBe(3000);
    expect(state.pendingEffects).toEqual([]);
  });
});

describe('official QA Wave188: B09010 full-scene switch', () => {
  it.each(['self', 'opp'] as const)('owner=%s switches out the source but still removes FILE top', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 188, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B09010.id, 'agasa'),
      sceneChar(FILLER.id, 'filler-1'), sceneChar(FILLER.id, 'filler-2'),
      sceneChar(FILLER.id, 'filler-3'), sceneChar(FILLER.id, 'filler-4'),
    ];
    state.players[owner].remove = [REVIVE_A.id, REVIVE_B.id];
    state.players[owner].file = [
      ...Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: FILE_FILLER.id })),
      { type: 'card-back', cardId: FILE_TOP.id },
    ];
    install(state, owner, `${owner}-B09010-switch`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'agasa', abilId: 'a1' }), B09010.id)
      .toEqual({ ok: true });
    const entry = pendingPick(B09010.id, 'a1', 'sceneEnter');
    const selected = [REVIVE_A.id, REVIVE_B.id].map(cardId => entry.candidates.find(item => item.cardId === cardId)!);
    expect(selected.every(Boolean)).toBe(true);
    choose(entry, selected[0]!.uid, {
      pickedUids: selected.map(item => item.uid),
      switchRemoveUids: ['agasa', 'filler-1'],
    });

    expect(current().players[owner].scene).toHaveLength(5);
    expect(current().players[owner].scene.some(card => card.uid === 'agasa')).toBe(false);
    expect(current().players[owner].scene.map(card => card.cardId))
      .toEqual(expect.arrayContaining([REVIVE_A.id, REVIVE_B.id]));
    expect(current().players[owner].remove).toContain(B09010.id);
    expect(current().players[owner].remove).toContain(FILE_TOP.id);
    expect(current().players[owner].file).toHaveLength(5);
  });
});

describe('official QA Wave188: B09011 original LP snapshot', () => {
  it.each(['self', 'opp'] as const)('owner=%s keeps existing LP modifiers after base LP becomes 1', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 188, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B09011.id, 'haibara'), sceneChar(LP0.id, 'lp-target')];
    mutate.char.modifyLP(state, 'lp-target', 2, 'turn');
    install(state, owner, `${owner}-B09011-modifier`);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'haibara', abilId: 'a1' }), B09011.id)
      .toEqual({ ok: true });
    expect(read.char.lp(current(), 'lp-target')).toBe(3);
  });

  it.each(['self', 'opp'] as const)('owner=%s keeps the resolved override after the source leaves', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 188, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B09011.id, 'haibara'), sceneChar(LP0.id, 'lp-target')];
    install(state, owner, `${owner}-B09011-source-leave`);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'haibara', abilId: 'a1' }), B09011.id)
      .toEqual({ ok: true });
    const afterLeave = produce(current(), draft => { mutate.scene.removeToRemove(draft, 'haibara', 'effect'); });
    expect(useGameStateStore.getState().setGameState(afterLeave)).toBe(true);
    expect(read.char.lp(current(), 'lp-target')).toBe(1);
    expect(current().players[owner].remove).toContain(B09011.id);
  });
});

describe('official QA Wave188: resolved guard bonus', () => {
  it.each(['self', 'opp'] as const)('owner=%s keeps B09014 AP after its qualifying ally leaves', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 188, player: opponent, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B09014.id, 'genta'), sceneChar(GUARD_ALLY.id, 'ally', { state: 'sleep' }),
    ];
    state.players[opponent].scene = [sceneChar(ATTACKER.id, 'attacker')];
    install(state, owner, `${owner}-B09014-guard`);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'ally' }), B09014.id)
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'genta' })).toEqual({ ok: true });
    expect(read.char.ap(current(), 'genta')).toBe(6000);
    const afterLeave = produce(current(), draft => { mutate.scene.removeToRemove(draft, 'ally', 'effect'); });
    expect(useGameStateStore.getState().setGameState(afterLeave)).toBe(true);
    expect(read.char.ap(current(), 'genta')).toBe(6000);
  });
});

describe('official QA Wave188: B09015 name branch ignores level', () => {
  it.each(['self', 'opp'] as const)('owner=%s may recover a level-7 Mitsuhiko', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 188, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B09015.id, 'asami')];
    state.players[owner].remove = [MITSUHIKO_L7.id, SBD4.id, SBD5.id];
    install(state, owner, `${owner}-B09015-name-branch`);

    expect(useGameStateStore.getState().dispatch(game => produce(game, draft => {
      mutate.scene.removeToRemove(draft, 'asami', 'effect');
      runAllUntilEmpty(draft);
    }))).toBe(true);
    const pick = pendingPick(B09015.id, 'a1', 'handAddFromRemove');
    expect(pick.candidates.map(item => item.cardId)).toEqual(expect.arrayContaining([MITSUHIKO_L7.id, SBD4.id]));
    expect(pick.candidates.some(item => item.cardId === SBD5.id)).toBe(false);
    chooseCard(pick, MITSUHIKO_L7.id);
    expect(current().players[owner].hand).toContain(MITSUHIKO_L7.id);
  });
});
