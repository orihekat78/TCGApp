// qa: card:B08082:08ef8905b5b4eb573b07e49f0d9dc2de389ef16dbaa5f7133ee5ae3eded6a568
// qa: card:B08083:56e6317ae0fcb1904bcc185b0e93d4ede7b38026693d891653b09d891b097bdc
// qa: card:B08085:1f49f9f42b38c241ebd655d06681a4cb1c6030ffaa8345da75416cb84193fc80
// qa: card:B08086:58763c5eec112da565cbb2892250eb844e45725c5b8575645188326a1a98dcd7
// qa: card:B08087:591941330ed685d92393564b7c3f5654a5a39a8a607f466572ad125f55ed3121
// qa: card:B08090:b4ce5e042cd2bc53905b70bee4615fde0133b86ff443681504d9156114def90c
// qa: card:B08091:426886de8581b320e3ebb09308f95cdb635a8c7c5a9cea88b3333ff26606f83d
// qa: card:B08091:d45db01562d3b77fc1186cb5501d517f8c12573a093e4aacf6f2913858e28de3

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08082 } from '@/cards/ct-p08/B08082';
import { B08083 } from '@/cards/ct-p08/B08083';
import { B08085 } from '@/cards/ct-p08/B08085';
import { B08086 } from '@/cards/ct-p08/B08086';
import { B08087 } from '@/cards/ct-p08/B08087';
import { B08090 } from '@/cards/ct-p08/B08090';
import { B08091 } from '@/cards/ct-p08/B08091';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EvidenceCard, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['黄'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const BLACK_PARTNER = fixture('W185_BLACK_PARTNER', {
  kind: 'partner', colors: ['黒'], level: undefined, ap: undefined, lp: 1,
});
const YELLOW_PARTNER = fixture('W185_YELLOW_PARTNER', {
  kind: 'partner', colors: ['黄'], level: undefined, ap: undefined, lp: 1,
});
const INACTIVE_LEAVER = fixture('W185_INACTIVE_LEAVER', {
  colors: ['青'], level: 5,
  abilities: [{
    id: 'leave-marker', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:to-remove', selfOnly: true },
    condition: { kind: 'turn', player: 'opp' },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: '【相手ターン中】【現場リムーブ時】。', ruleRefs: [],
  }],
});
const NO_LEAVE = fixture('W185_NO_LEAVE', { colors: ['青'], level: 5 });
const LEAVE_HIGH = fixture('W185_LEAVE_HIGH', {
  colors: ['青'], level: 7,
  abilities: INACTIVE_LEAVER.abilities,
});
const NON_BLACK = fixture('W185_NON_BLACK', { colors: ['青'], level: 2 });
const BLACK_FILLER = fixture('W185_BLACK_FILLER', { colors: ['黒'], level: 2 });
const OPP_SCENE = fixture('W185_OPP_SCENE', { colors: ['赤'], level: 2 });
const EVIDENCE_A = fixture('W185_EVIDENCE_A', { kind: 'event' });
const EVIDENCE_B = fixture('W185_EVIDENCE_B', { kind: 'event' });
const EVIDENCE_C = fixture('W185_EVIDENCE_C', { kind: 'event' });
const DRAW = fixture('W185_DRAW', { kind: 'event' });

const LEAVE_REMOVER = fixture('W185_LEAVE_REMOVER', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'sceneRemove',
      args: {
        player: 'self', side: 'either', max: 1,
        filter: { kind: 'character', cardName: 'シェリー' }, cause: 'effect',
      },
    },
    description: 'シェリーを1枚まで選び、リムーブする。', ruleRefs: [],
  }],
});

const FORCED_EVENT = fixture('W185_FORCED_EVENT', {
  kind: 'event', level: 1,
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-hand',
    trigger: {
      hook: 'effect:declared', selfOnly: true,
      matcher: payload => (payload as { kind?: unknown })?.kind === 'event-use',
    },
    effect: {
      kind: 'atom', verb: 'sceneRemove',
      args: { player: 'self', side: 'opp', max: 1, filter: { kind: 'character' }, cause: 'effect' },
    },
    description: '相手のキャラを1枚まで選び、リムーブする。', ruleRefs: [],
  }],
});

const REACTIVATOR = fixture('W185_REACTIVATOR', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'sceneSetState',
      args: {
        player: 'self', side: 'self', max: 1, state: 'active',
        filter: { cardName: 'ベルモット' },
      },
    },
    description: 'ベルモットをアクティブにする。', ruleRefs: [],
  }],
});

const FIXTURES = [
  BLACK_PARTNER, YELLOW_PARTNER, INACTIVE_LEAVER, NO_LEAVE, LEAVE_HIGH,
  NON_BLACK, BLACK_FILLER, OPP_SCENE, EVIDENCE_A, EVIDENCE_B, EVIDENCE_C,
  DRAW, LEAVE_REMOVER, FORCED_EVENT, REACTIVATOR,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave185 game state');
  return state;
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: DRAW.id }));
}

function evidence(cardId: string, faceUp: boolean): EvidenceCard {
  return { cardId, faceUp, origin: { turn: 1, via: 'reasoning' } };
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave185-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, pickedUid: string | null, switchRemoveUid?: string): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid, ...(switchRemoveUid ? { switchRemoveUid } : {}),
  }))).toEqual({ ok: true });
}

function chooseCard(pending: PendingPick, cardId: string | null, switchRemoveUid?: string): void {
  const pickedUid = cardId === null
    ? null
    : pending.candidates.find(candidate => candidate.cardId === cardId)?.uid;
  if (cardId !== null) expect(pickedUid, `${cardId} must be selectable`).toBeTruthy();
  choose(pending, pickedUid ?? null, switchRemoveUid);
}

function closeCaseAction(actionId: string): void {
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  for (let step = 0; step < 6 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function removeB08085(owner: Player): void {
  const opponent = other(owner);
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: `${opponent}-remover`, abilId: 'a1' }))
    .toEqual({ ok: true });
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  if (pending?.atomVerb === 'sceneRemove') chooseCard(pending, B08085.id);
  expect(current().players[owner].scene.some(card => card.cardId === B08085.id)).toBe(false);
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave185: printed leave-ability presence', () => {
  it.each(['self', 'opp'] as const)('owner=%s B08082 may reveal a currently inactive leave ability', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 185, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黒'];
    state.players[owner].file = fileCards(5);
    state.players[owner].hand = [B08082.id, INACTIVE_LEAVER.id, NO_LEAVE.id];
    state.players[owner].deck = [DRAW.id];
    install(state, owner, `${owner}-B08082-static-leave`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08082.id }))
      .toEqual({ ok: true });
    const reveal = pendingPick(B08082.id, 'a1', 'handReveal');
    expect(reveal.candidates.map(candidate => candidate.cardId)).toEqual([INACTIVE_LEAVER.id]);
    chooseCard(reveal, INACTIVE_LEAVER.id);
    const pisco = current().players[owner].scene.find(card => card.cardId === B08082.id)!;
    expect(read.char.hasKeyword(current(), pisco.uid, '突撃')).toBe(true);
    expect(current().players[owner].hand).toEqual([INACTIVE_LEAVER.id, NO_LEAVE.id]);
  });

  it.each(['self', 'opp'] as const)('owner=%s B08083 may enter a currently inactive leave ability', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 185, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['青', '黒'];
    state.players[owner].scene = [sceneChar(B08083.id, 'rum')];
    state.players[owner].hand = [INACTIVE_LEAVER.id, NO_LEAVE.id, LEAVE_HIGH.id];
    install(state, owner, `${owner}-B08083-static-leave`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'rum', abilId: 'a2' }))
      .toEqual({ ok: true });
    const enter = pendingPick(B08083.id, 'a2', 'sceneEnter');
    expect(enter.candidates.map(candidate => candidate.cardId)).toEqual([INACTIVE_LEAVER.id]);
    chooseCard(enter, INACTIVE_LEAVER.id);
    expect(current().players[owner].scene.find(card => card.cardId === INACTIVE_LEAVER.id)?.state)
      .toBe('active');
    expect(current().players[owner].scene.find(card => card.uid === 'rum')?.state).toBe('sleep');
  });
});

describe('official QA Wave185: B08085 evidence position', () => {
  it.each(['self', 'opp'] as const)('owner=%s may flip any face-down opposing evidence without reordering', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 185, player: opponent, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['青', '黒'];
    state.players[owner].scene = [sceneChar(B08085.id, `${owner}-sherry`)];
    state.players[opponent].scene = [sceneChar(LEAVE_REMOVER.id, `${opponent}-remover`)];
    state.players[opponent].evidence = [
      evidence(EVIDENCE_A.id, false), evidence(EVIDENCE_B.id, true), evidence(EVIDENCE_C.id, false),
    ];
    install(state, owner, `${owner}-B08085-evidence-position`);

    removeB08085(owner);
    const flip = pendingPick(B08085.id, 'a1', 'evidenceFlip');
    expect(flip.candidates.map(candidate => candidate.cardId))
      .toEqual([EVIDENCE_A.id, EVIDENCE_C.id]);
    chooseCard(flip, EVIDENCE_C.id);
    expect(current().players[opponent].evidence.map(card => card.cardId))
      .toEqual([EVIDENCE_A.id, EVIDENCE_B.id, EVIDENCE_C.id]);
    expect(current().players[opponent].evidence.map(card => card.faceUp))
      .toEqual([false, true, true]);
  });
});

describe('official QA Wave185: B08086 automatic opponent-count AP', () => {
  it.each(['self', 'opp'] as const)('owner=%s updates AP immediately from only the opposing scene', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 185, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner.cardId = BLACK_PARTNER.id;
    state.players[owner].scene = [sceneChar(B08086.id, 'tequila'), sceneChar(BLACK_FILLER.id, 'own-decoy')];
    install(state, owner, `${owner}-B08086-count`);
    expect(read.char.ap(current(), 'tequila')).toBe(0);

    const one = structuredClone(current());
    one.players[opponent].scene = [sceneChar(OPP_SCENE.id, 'opp-1')];
    expect(useGameStateStore.getState().setGameState(one)).toBe(true);
    expect(read.char.ap(current(), 'tequila')).toBe(2000);

    const three = structuredClone(current());
    three.players[opponent].scene.push(sceneChar(OPP_SCENE.id, 'opp-2'), sceneChar(OPP_SCENE.id, 'opp-3'));
    expect(useGameStateStore.getState().setGameState(three)).toBe(true);
    expect(read.char.ap(current(), 'tequila')).toBe(6000);

    const wrongTurn = structuredClone(current());
    wrongTurn.turn.player = opponent;
    expect(read.char.ap(wrongTurn, 'tequila')).toBe(0);
    const wrongPartner = structuredClone(current());
    wrongPartner.players[owner].partner.cardId = YELLOW_PARTNER.id;
    expect(read.char.ap(wrongPartner, 'tequila')).toBe(0);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });
});

describe('official QA Wave185: B08087 mandatory opposing-event target', () => {
  it.each(['self', 'opp'] as const)('owner=%s forces the event user to select B08087 when eligible', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 185, player: opponent, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[opponent].case.colors = ['黄'];
    state.players[opponent].file = fileCards(1);
    state.players[opponent].hand = [FORCED_EVENT.id];
    state.players[owner].scene = [sceneChar(B08087.id, 'forced'), sceneChar(NO_LEAVE.id, 'decoy')];
    install(state, opponent, `${owner}-B08087-forced`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: opponent, cardId: FORCED_EVENT.id }))
      .toEqual({ ok: true });
    const pick = pendingPick(FORCED_EVENT.id, 'a1', 'sceneRemove');
    expect(pick.forcedUids).toEqual(['forced']);
    const before = JSON.stringify(current());
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: 'decoy',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
    expect(useGameStateStore.getState().pendingEffectPick).toBe(pick);
    choose(pick, 'forced');
    expect(current().players[owner].remove).toContain(B08087.id);
    expect(current().players[owner].scene.some(card => card.uid === 'decoy')).toBe(true);
  });

  it.each(['self', 'opp'] as const)('owner=%s does not force B08087 from outside the scene', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 185, player: opponent, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[opponent].case.colors = ['黄'];
    state.players[opponent].file = fileCards(1);
    state.players[opponent].hand = [FORCED_EVENT.id];
    state.players[owner].scene = [sceneChar(NO_LEAVE.id, 'decoy')];
    state.players[owner].remove = [B08087.id];
    install(state, opponent, `${owner}-B08087-outside-scene`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: opponent, cardId: FORCED_EVENT.id }))
      .toEqual({ ok: true });
    const pick = pendingPick(FORCED_EVENT.id, 'a1', 'sceneRemove');
    expect(pick.forcedUids ?? []).toEqual([]);
    expect(pick.candidates.map(candidate => candidate.uid)).toEqual(['decoy']);
    expect(current().players[owner].scene.some(card => card.uid === 'decoy')).toBe(true);
    choose(pick, 'decoy');
    expect(current().players[owner].scene.some(card => card.uid === 'decoy')).toBe(false);
    expect(current().players[owner].remove).toContain(NO_LEAVE.id);
    expect(current().players[owner].remove.filter(cardId => cardId === B08087.id)).toHaveLength(1);
  });
});

describe('official QA Wave185: B08090 naming survives reactivation', () => {
  it.each(['self', 'opp'] as const)('owner=%s may action again but may not reason after reactivation', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 185, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黒'];
    state.players[owner].file = fileCards(6);
    state.players[owner].hand = [B08090.id];
    state.players[owner].scene = [
      sceneChar(NON_BLACK.id, 'non-black'), sceneChar(REACTIVATOR.id, 'reactivator'),
    ];
    state.players[owner].deck = [DRAW.id, DRAW.id, DRAW.id];
    state.players[opponent].deck = [DRAW.id, DRAW.id];
    state.players[opponent].evidence = [evidence(EVIDENCE_A.id, false), evidence(EVIDENCE_B.id, false)];
    install(state, owner, `${owner}-B08090-naming`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08090.id }))
      .toEqual({ ok: true });
    const vermouth = current().players[owner].scene.find(card => card.cardId === B08090.id)!;
    expect(read.char.hasKeyword(current(), vermouth.uid, '突撃')).toBe(true);
    expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: vermouth.uid, targetPlayer: opponent }))
      .toEqual({ ok: true });
    closeCaseAction(useGameStateStore.getState().activeActionId!);

    expect(current().turn.player).toBe(owner);
    expect(current().gameResult).toBeUndefined();
    expect(current().players[owner].scene.find(card => card.uid === 'reactivator')?.state).toBe('active');
    expect(current().pendingEffects.filter(entry => entry.state === 'pending')).toEqual([]);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'reactivator', abilId: 'a1' }))
      .toEqual({ ok: true });
    choose(pendingPick(REACTIVATOR.id, 'a1', 'sceneSetState'), vermouth.uid);
    expect(dispatchEngineAction({ type: 'reasoning', uid: vermouth.uid }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: vermouth.uid, targetPlayer: opponent }))
      .toEqual({ ok: true });
  });
});

describe('official QA Wave185: B08091 full-scene static leave recruit', () => {
  it.each(['self', 'opp'] as const)('owner=%s recruits an inactive leave card and switches out B08091 itself', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 185, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['青', '黒'];
    state.players[owner].file = fileCards(7);
    state.players[owner].hand = [B08091.id];
    state.players[owner].scene = [
      sceneChar(NON_BLACK.id, 'non-black'),
      sceneChar(BLACK_FILLER.id, 'black-1'),
      sceneChar(BLACK_FILLER.id, 'black-2'),
      sceneChar(BLACK_FILLER.id, 'black-3'),
    ];
    state.players[owner].remove = [INACTIVE_LEAVER.id, NO_LEAVE.id, LEAVE_HIGH.id];
    install(state, owner, `${owner}-B08091-self-switch`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08091.id }))
      .toEqual({ ok: true });
    const source = current().players[owner].scene.find(card => card.cardId === B08091.id)!;
    const enter = pendingPick(B08091.id, 'a1', 'sceneEnter');
    expect(enter.candidates.map(candidate => candidate.cardId)).toEqual([INACTIVE_LEAVER.id]);
    chooseCard(enter, INACTIVE_LEAVER.id, source.uid);

    expect(current().players[owner].scene).toHaveLength(5);
    expect(current().players[owner].scene.some(card => card.cardId === B08091.id)).toBe(false);
    expect(current().players[owner].remove).toContain(B08091.id);
    expect(current().players[owner].scene.find(card => card.cardId === INACTIVE_LEAVER.id)?.state)
      .toBe('sleep');
  });
});
