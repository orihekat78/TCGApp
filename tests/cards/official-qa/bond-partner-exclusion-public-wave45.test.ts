// qa: card:B05007:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B05008:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B05009:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B05048:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B05051:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B05052:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B05091:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:D10005:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:D10006:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:D10022:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:PR136:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:PR142:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// Rules: 17-icons.md: 【絆】reads the self scene; a partner never satisfies it.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05007 } from '@/cards/ct-p05/B05007';
import { B05008 } from '@/cards/ct-p05/B05008';
import { B05009 } from '@/cards/ct-p05/B05009';
import { B05048 } from '@/cards/ct-p05/B05048';
import { B05051 } from '@/cards/ct-p05/B05051';
import { B05052 } from '@/cards/ct-p05/B05052';
import { B05091 } from '@/cards/ct-p05/B05091';
import { D02015 } from '@/cards/ct-d02/D02015';
import { D10005 } from '@/cards/ct-d10/D10005';
import { D10006 } from '@/cards/ct-d10/D10006';
import { D10022 } from '@/cards/ct-d10/D10022';
import { PR136 } from '@/cards/pr-01/PR136';
import { PR142 } from '@/cards/pr-01/PR142';
import { evalCond } from '@/engine/cond/eval';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EffectCtx, GameState, Player } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const COST = 'W45_COST';
const DRAW = 'W45_DRAW';
const DECK_FILLER = 'W45_DECK_FILLER';
const TARGET = 'W45_TARGET';
const DECOY = 'W45_DECOY';
const WRONG_PARTNER = 'W45_WRONG_PARTNER';
const GREEN_PARTNER = 'W45_GREEN_PARTNER';

const names = {
  KUDO: '工藤新一',
  CONAN: '江戸川コナン',
  KOGORO: '毛利小五郎',
  AOKO: '中森青子',
  SONOKO: '鈴木園子',
  YUKIKO: '工藤有希子',
  FURUYA: '降谷零',
  MOMIJI: '大岡紅葉',
} as const;

function card(id: string, cardNames: string[] = [id], options: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: cardNames,
    colors: ['青'],
    level: 1,
    ap: 1000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...options,
  } as CardDef;
}

const sceneNames = {
  KUDO: card('W45_SCENE_KUDO', [names.KUDO]),
  CONAN: card('W45_SCENE_CONAN', [names.CONAN]),
  KOGORO: card('W45_SCENE_KOGORO', [names.KOGORO]),
  AOKO: card('W45_SCENE_AOKO', [names.AOKO]),
  SONOKO: card('W45_SCENE_SONOKO', [names.SONOKO]),
  YUKIKO: card('W45_SCENE_YUKIKO', [names.YUKIKO]),
  FURUYA: card('W45_SCENE_FURUYA', [names.FURUYA]),
  MOMIJI: card('W45_SCENE_MOMIJI', [names.MOMIJI]),
} as const;

const partnerNames = {
  KUDO: card('W45_PARTNER_KUDO', [names.KUDO], { kind: 'partner', level: 0, lp: 5 }),
  CONAN: card('W45_PARTNER_CONAN', [names.CONAN], { kind: 'partner', level: 0, lp: 5 }),
  KOGORO: card('W45_PARTNER_KOGORO', [names.KOGORO], { kind: 'partner', level: 0, lp: 5 }),
  AOKO: card('W45_PARTNER_AOKO', [names.AOKO], { kind: 'partner', level: 0, lp: 5 }),
  SONOKO: card('W45_PARTNER_SONOKO', [names.SONOKO], { kind: 'partner', level: 0, lp: 5 }),
  YUKIKO: card('W45_PARTNER_YUKIKO', [names.YUKIKO], { kind: 'partner', level: 0, lp: 5 }),
  FURUYA: card('W45_PARTNER_FURUYA', [names.FURUYA], { kind: 'partner', level: 0, lp: 5 }),
  MOMIJI: card('W45_PARTNER_MOMIJI', [names.MOMIJI], { kind: 'partner', level: 0, lp: 5 }),
} as const;

const fixtures = [
  ...Object.values(sceneNames),
  ...Object.values(partnerNames),
  card(COST),
  card(DRAW),
  card(DECK_FILLER),
  card(TARGET, [TARGET], { ap: 1000 }),
  card(DECOY, [DECOY], { ap: 1000 }),
  card(WRONG_PARTNER, [WRONG_PARTNER], { kind: 'partner', level: 0, lp: 5 }),
  card(GREEN_PARTNER, [GREEN_PARTNER], { kind: 'partner', colors: ['緑'], level: 0, lp: 5 }),
];

function base(turnPlayer: Player = 'self'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.deck = [DRAW, DECK_FILLER];
  return state;
}

function setPartner(state: GameState, player: Player, cardId: string): void {
  state.players[player].partner = { cardId, state: 'active', location: 'partner-area' };
}

function install(state: GameState, label: string, human: Player = 'self'): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  resetPresentationQueue(label);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave45 state');
  return state;
}

function resolveCurrentPick(pickedUid: string): void {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve',
    pickedUid,
  }))).toEqual({ ok: true });
}

function closeAction(actionId: string): void {
  for (let step = 0; step < 3 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function b05007DeclaredBond(source: CardDef) {
  const partnerOnly = base();
  partnerOnly.players.self.scene = [sceneChar(source.id, 'source')];
  partnerOnly.players.self.hand = [COST];
  setPartner(partnerOnly, 'self', partnerNames.KOGORO.id);
  install(partnerOnly, 'w45-b05007-partner');
  const partnerResult = dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: 'a2',
    abilityOrigin: 'printed', abilityIndex: 1,
    costParams: { removeFromHand: { indices: [0] } },
  });
  const partnerHand = [...current().players.self.hand];

  const sceneBond = base();
  sceneBond.players.self.scene = [
    sceneChar(source.id, 'source'),
    sceneChar(sceneNames.KOGORO.id, 'bond'),
  ];
  sceneBond.players.self.hand = [COST];
  setPartner(sceneBond, 'self', WRONG_PARTNER);
  install(sceneBond, 'w45-b05007-scene');
  const sceneResult = dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: 'a2',
    abilityOrigin: 'printed', abilityIndex: 1,
    costParams: { removeFromHand: { indices: [0] } },
  });
  return {
    partnerResult,
    partnerHand,
    sceneResult,
    sceneCostRemoved: current().players.self.remove.includes(COST),
    sceneCount: readChar.declaredUseCount(current(), 'source', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    }),
  };
}

function dispatchRemovalEvent(): NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']> {
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'opp', cardId: D02015.id })).toEqual({ ok: true });
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toBeTruthy();
  return pick!;
}

function b05008Protection(source: CardDef) {
  const stateFor = (sceneBond: boolean): GameState => {
    const state = base('opp');
    state.players.opp.hand = [D02015.id];
    state.players.opp.case.colors = ['緑'];
    state.players.opp.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
    setPartner(state, 'opp', GREEN_PARTNER);
    setPartner(state, 'self', sceneBond ? WRONG_PARTNER : partnerNames.CONAN.id);
    state.players.self.scene = [
      sceneChar(source.id, 'protected'),
      ...(sceneBond ? [sceneChar(sceneNames.CONAN.id, 'bond')] : []),
      sceneChar(DECOY, 'decoy'),
    ];
    return state;
  };

  install(stateFor(false), 'w45-b05008-partner', 'opp');
  const partnerCandidates = dispatchRemovalEvent().candidates.map((candidate) => candidate.uid);
  resolveCurrentPick('protected');

  install(stateFor(true), 'w45-b05008-scene', 'opp');
  const sceneCandidates = dispatchRemovalEvent().candidates.map((candidate) => candidate.uid);
  resolveCurrentPick('decoy');
  return { partnerCandidates, sceneCandidates };
}

function b05048Aura(source: CardDef) {
  const ability = source.abilities[0]!;
  const ctx: EffectCtx = {
    source: { player: 'self', area: 'scene', cardId: source.id, uid: 'source', abilityId: 'a1' },
    bindings: {},
  };
  const partnerOnly = base();
  partnerOnly.players.self.scene = [sceneChar(source.id, 'source')];
  setPartner(partnerOnly, 'self', partnerNames.AOKO.id);
  const partnerCondition = evalCond(partnerOnly, ability.condition!, ctx);
  const sceneBond = base();
  sceneBond.players.self.scene = [sceneChar(source.id, 'source'), sceneChar(sceneNames.AOKO.id, 'aoko')];
  setPartner(sceneBond, 'self', WRONG_PARTNER);
  const sceneCondition = evalCond(sceneBond, ability.condition!, ctx);

  const publicState = base('opp');
  publicState.players.opp.hand = [D02015.id];
  publicState.players.opp.case.colors = ['緑'];
  publicState.players.opp.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  setPartner(publicState, 'opp', GREEN_PARTNER);
  setPartner(publicState, 'self', WRONG_PARTNER);
  publicState.players.self.scene = [
    sceneChar(source.id, 'source'),
    sceneChar(sceneNames.AOKO.id, 'aoko'),
    sceneChar(DECOY, 'decoy'),
  ];
  install(publicState, 'w45-b05048-public', 'opp');
  const candidates = dispatchRemovalEvent().candidates.map((candidate) => candidate.uid);
  resolveCurrentPick('decoy');
  return { partnerCondition, sceneCondition, candidates };
}

function contactDrawBond(source: CardDef, label: string) {
  const run = (sceneBond: boolean) => {
    const state = base();
    setPartner(state, 'self', sceneBond ? WRONG_PARTNER : partnerNames.KUDO.id);
    state.players.self.scene = [
      sceneChar(source.id, 'source'),
      ...(sceneBond ? [sceneChar(sceneNames.KUDO.id, 'bond')] : []),
    ];
    state.players.opp.scene = [sceneChar(TARGET, 'target', { state: 'sleep' })];
    install(state, `w45-contact-${label}-${sceneBond ? 'scene' : 'partner'}`);
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target' })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    surfacePendingSideChannels();
    closeAction(actionId);
    return {
      drew: current().players.self.hand.includes(DRAW),
      targetRemoved: current().players.opp.remove.includes(TARGET),
    };
  };
  return { partnerOnly: run(false), sceneBond: run(true) };
}

function endTurnDrawBond(source: CardDef) {
  const run = (sceneBond: boolean) => {
    const state = base();
    setPartner(state, 'self', sceneBond ? WRONG_PARTNER : partnerNames.SONOKO.id);
    state.players.self.scene = [
      sceneChar(source.id, 'source'),
      ...(sceneBond ? [sceneChar(sceneNames.SONOKO.id, 'bond')] : []),
    ];
    install(state, `w45-end-${sceneBond ? 'scene' : 'partner'}`);
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    return current().players.self.hand.includes(DRAW);
  };
  return { partnerOnly: run(false), sceneBond: run(true) };
}

function continuousBond(
  source: CardDef,
  sceneWitness: CardDef,
  partnerWitness: CardDef,
  read: (state: GameState) => unknown,
) {
  const partnerOnly = base();
  partnerOnly.players.self.scene = [sceneChar(source.id, 'source')];
  setPartner(partnerOnly, 'self', partnerWitness.id);
  install(partnerOnly, `w45-continuous-${source.id}-partner`);
  const partnerValue = read(current());

  const sceneBond = base();
  sceneBond.players.self.scene = [sceneChar(source.id, 'source'), sceneChar(sceneWitness.id, 'bond')];
  setPartner(sceneBond, 'self', WRONG_PARTNER);
  install(sceneBond, `w45-continuous-${source.id}-scene`);
  return { partnerOnly: partnerValue, sceneBond: read(current()) };
}

function declaredEventBond(source: CardDef, label: string) {
  const run = (sceneBond: boolean) => {
    const state = base();
    state.players.self.scene = [
      sceneChar(source.id, 'source'),
      ...(sceneBond ? [sceneChar(sceneNames.KUDO.id, 'bond')] : []),
    ];
    setPartner(state, 'self', sceneBond ? WRONG_PARTNER : partnerNames.KUDO.id);
    install(state, `w45-declared-${label}-${sceneBond ? 'scene' : 'partner'}`);
    const result = dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
    });
    return {
      result,
      count: readChar.declaredUseCount(current(), 'source', 'a2', {
        abilityOrigin: 'printed', abilityIndex: 1,
      }),
    };
  };
  return { partnerOnly: run(false), sceneBond: run(true) };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.getState().setGameState(null);
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetActionContexts();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave45: Bond never counts the partner area', () => {
  it('B05007 declared bond rejects partner-only before cost and accepts a scene witness', () => {
    expect(b05007DeclaredBond(B05007)).toEqual({
      partnerResult: { ok: false, reason: 'not-allowed' },
      partnerHand: [COST],
      sceneResult: { ok: true },
      sceneCostRemoved: true,
      sceneCount: 1,
    });
  });

  it('B05008 partner-only is targetable, while a scene Conan activates protection', () => {
    expect(b05008Protection(B05008)).toEqual({
      partnerCandidates: expect.arrayContaining(['protected']),
      sceneCandidates: expect.not.arrayContaining(['protected']),
    });
  });

  it('B05009 contact draw needs Kudo in scene, not in the partner area', () => {
    expect(contactDrawBond(B05009, 'B05009')).toEqual({
      partnerOnly: { drew: false, targetRemoved: true },
      sceneBond: { drew: true, targetRemoved: true },
    });
  });

  it('B05048 canonical bond excludes partner-only and its public aura protects scene Aoko', () => {
    const result = b05048Aura(B05048);
    expect(result.partnerCondition).toBe(false);
    expect(result.sceneCondition).toBe(true);
    expect(result.candidates, 'B05048: scene Aoko protected').not.toContain('aoko');
    expect(result.candidates, 'B05048: bearer remains targetable').toContain('source');
  });

  it('B05051 turn-end draw needs Sonoko in scene, not in the partner area', () => {
    expect(endTurnDrawBond(B05051)).toEqual({ partnerOnly: false, sceneBond: true });
  });

  it('B05052 AP and Assault bond needs Yukiko in scene, not in the partner area', () => {
    expect(continuousBond(
      B05052,
      sceneNames.YUKIKO,
      partnerNames.YUKIKO,
      (state) => ({ ap: readChar.ap(state, 'source'), assault: readChar.hasKeyword(state, 'source', '突撃') }),
    )).toEqual({
      partnerOnly: { ap: 3000, assault: false },
      sceneBond: { ap: 6000, assault: true },
    });
  });

  it('B05091 Assault[character] bond needs Furuya in scene, not in the partner area', () => {
    expect(continuousBond(
      B05091,
      sceneNames.FURUYA,
      partnerNames.FURUYA,
      (state) => readChar.hasKeyword(state, 'source', '突撃[キャラ]'),
    )).toEqual({ partnerOnly: false, sceneBond: true });
  });

  it('D10005 declared event route rejects partner-only and accepts scene Kudo', () => {
    expect(declaredEventBond(D10005, 'D10005')).toEqual({
      partnerOnly: { result: { ok: false, reason: 'not-allowed' }, count: 0 },
      sceneBond: { result: { ok: true }, count: 1 },
    });
  });

  it('D10006 declared event route rejects partner-only and accepts scene Kudo', () => {
    expect(declaredEventBond(D10006, 'D10006')).toEqual({
      partnerOnly: { result: { ok: false, reason: 'not-allowed' }, count: 0 },
      sceneBond: { result: { ok: true }, count: 1 },
    });
  });

  it('D10022 contact draw needs Kudo in scene, not in the partner area', () => {
    expect(contactDrawBond(D10022, 'D10022')).toEqual({
      partnerOnly: { drew: false, targetRemoved: true },
      sceneBond: { drew: true, targetRemoved: true },
    });
  });

  it('PR136 LP bond needs Momiji in scene, not in the partner area', () => {
    expect(continuousBond(
      PR136,
      sceneNames.MOMIJI,
      partnerNames.MOMIJI,
      (state) => readChar.lp(state, 'source'),
    )).toEqual({ partnerOnly: 0, sceneBond: 1 });
  });

  it('PR142 LP bond needs Momiji in scene, not in the partner area', () => {
    expect(continuousBond(
      PR142,
      sceneNames.MOMIJI,
      partnerNames.MOMIJI,
      (state) => readChar.lp(state, 'source'),
    )).toEqual({ partnerOnly: 0, sceneBond: 1 });
  });
});
