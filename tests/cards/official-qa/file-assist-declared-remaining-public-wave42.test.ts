// qa: card:B07069:cbce41c9b0c72cca046ffb06c2b4ff9c3af679af4bcfb692fac12dc0b5998a23
// qa: card:B07069:fe60095d4b257e19dc003f76a307b4b68db03357af49ee5e3c4159c46e86e96d
// qa: card:B08004:0b717e7ed550284fdf464f7f33e6c412c355fb6b492d66373c2469c1fb4f771b
// qa: card:B08007:0b717e7ed550284fdf464f7f33e6c412c355fb6b492d66373c2469c1fb4f771b
// qa: card:B09055:cbce41c9b0c72cca046ffb06c2b4ff9c3af679af4bcfb692fac12dc0b5998a23
// qa: card:B09060:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// qa: card:PR179:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// qa: card:PR185:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// qa: card:PR199:0b717e7ed550284fdf464f7f33e6c412c355fb6b492d66373c2469c1fb4f771b
// qa: card:PR205:0b717e7ed550284fdf464f7f33e6c412c355fb6b492d66373c2469c1fb4f771b
// Rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07069 } from '@/cards/ct-p07/B07069';
import { B07069P } from '@/cards/ct-p07/B07069P';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityCostParams } from '@/engine/flow/main/ability-activate';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const BLUE_PARTNER = 'D08001';
const RED_PARTNER = 'W42_RED_PARTNER';
const RED_ENTRY = 'W42_RED_ENTRY';
const HAIBARA = 'W42_HAIBARA';
const HAND_COST = 'W42_HAND_COST';
const DUAL = 'W42_DUAL';
const BOTH_TRAITS = 'W42_BOTH_TRAITS';
const STUDENT = 'W42_STUDENT';
const KOGORO = 'W42_KOGORO';
const BLACK_A = 'W42_BLACK_A';
const BLACK_B = 'W42_BLACK_B';
const BLACK_C = 'W42_BLACK_C';
const DECOY = 'W42_DECOY';

type Row = {
  cardId: 'B07069' | 'B08004' | 'B08007' | 'B09055' | 'B09060' | 'PR179' | 'PR185' | 'PR199' | 'PR205';
  threshold: number;
  abilityId: 'a1' | 'a2' | 'a4';
  abilityIndex: number;
  costParams?: AbilityCostParams;
  pickTarget?: string;
  choiceIndex?: number;
};

const ROWS: Row[] = [
  { cardId: 'B07069', threshold: 8, abilityId: 'a2', abilityIndex: 1, costParams: { removeFromHand: { indices: [0] } }, pickTarget: RED_ENTRY },
  { cardId: 'B08004', threshold: 5, abilityId: 'a2', abilityIndex: 1, costParams: { stunChar: { uids: ['haibara'] } } },
  { cardId: 'B08007', threshold: 5, abilityId: 'a4', abilityIndex: 3, costParams: { removeFromHand: { indices: [0] } } },
  { cardId: 'B09055', threshold: 8, abilityId: 'a2', abilityIndex: 1, costParams: { removeFromHand: { indices: [0] } }, pickTarget: DUAL },
  { cardId: 'B09060', threshold: 7, abilityId: 'a1', abilityIndex: 0, costParams: { removeFromHand: { indices: [0] } } },
  { cardId: 'PR179', threshold: 7, abilityId: 'a1', abilityIndex: 0 },
  { cardId: 'PR185', threshold: 7, abilityId: 'a1', abilityIndex: 0 },
  { cardId: 'PR199', threshold: 5, abilityId: 'a1', abilityIndex: 0, choiceIndex: 2, pickTarget: KOGORO },
  { cardId: 'PR205', threshold: 5, abilityId: 'a1', abilityIndex: 0, choiceIndex: 2, pickTarget: KOGORO },
];

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 4,
    ap: 3000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

function cardBacks(prefix: string, count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `${prefix}-${index}`,
  }));
}

function stateFor(row: Row, beforeCount: number, withStack = true): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = {
    cardId: row.cardId === 'B09055' ? RED_PARTNER : BLUE_PARTNER,
    state: 'active', location: 'partner-area',
  };
  state.players.self.case.status = '解決編';
  state.players.self.file = cardBacks(`${row.cardId}-SELF-FILE`, beforeCount);
  state.players.self.scene = [sceneChar(row.cardId, 'source')];

  if (row.cardId === 'B07069') state.players.self.hand = [RED_ENTRY];
  if (row.cardId === 'B08004') {
    state.players.self.case.colors = ['青', '黒'];
    state.players.self.scene = [
      sceneChar(row.cardId, 'source', { state: 'sleep' }),
      sceneChar(HAIBARA, 'haibara', { state: 'active' }),
    ];
    state.players.self.remove = [BLACK_A, BLACK_B, BLACK_C];
  }
  if (row.cardId === 'B08007') {
    state.players.self.scene = [sceneChar(row.cardId, 'source', {
      state: 'sleep', stackedCards: withStack ? 3 : 0,
    })];
    state.players.self.hand = [HAND_COST];
  }
  if (row.cardId === 'B09055') state.players.self.hand = [DUAL];
  if (row.cardId === 'B09060') state.players.self.hand = [BOTH_TRAITS];
  if (row.cardId === 'PR179' || row.cardId === 'PR185') state.players.self.hand = [STUDENT, DECOY];
  if (row.cardId === 'PR199' || row.cardId === 'PR205') {
    state.players.self.scene.push(sceneChar(KOGORO, 'kogoro', { state: 'sleep' }));
  }

  state.players.opp.partner = { cardId: BLUE_PARTNER, state: 'sleep', location: 'file-area' };
  state.players.opp.file = [
    ...cardBacks(`${row.cardId}-OPP-FILE`, row.threshold - 1),
    { type: 'assisted-partner', cardId: BLUE_PARTNER },
  ];
  return state;
}

function installPrepared(state: GameState, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function install(row: Row, beforeCount: number, withStack = true): void {
  installPrepared(
    stateFor(row, beforeCount, withStack),
    `qa-w42-${row.cardId}-${beforeCount}-${withStack ? 'stack' : 'no-stack'}`,
  );
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave42 state');
  return state;
}

function resolveContinuation(row: Row): { choices: string[]; source: string | null } {
  const choices: string[] = [];
  let source: string | null = null;
  surfacePendingSideChannels();
  const choice = useGameStateStore.getState().pendingEffectChoice;
  if (choice && row.choiceIndex !== undefined) {
    source = choice.source.cardId;
    expect(choice.source).toMatchObject({ cardId: row.cardId, uid: 'source', abilityId: row.abilityId });
    expect(dispatchEngineAction(bindPendingDecision(choice, {
      type: 'choiceResolve', choiceIndex: row.choiceIndex,
    }))).toEqual({ ok: true });
    choices.push('choice');
  }

  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  if (pick) {
    source = pick.source.cardId;
    expect(pick.source).toMatchObject({ cardId: row.cardId, uid: 'source', abilityId: row.abilityId });
    const pickedUid = row.pickTarget
      ? pick.candidates.find(candidate => candidate.cardId === row.pickTarget)?.uid ?? null
      : null;
    if (row.pickTarget) expect(pickedUid, `${row.cardId}: exact continuation target`).not.toBeNull();
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid,
    }))).toEqual({ ok: true });
    choices.push('pick');
  }
  return { choices, source };
}

function run(row: Row, beforeCount: number, withStack = true) {
  install(row, beforeCount, withStack);
  const assist = dispatchEngineAction({ type: 'assist', player: 'self' }).ok;
  const declared = dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: row.abilityId,
    costParams: row.costParams,
  }).ok;
  const continuation = resolveContinuation(row);
  const state = current();
  const source = state.players.self.scene.find(character => character.uid === 'source');
  const kogoro = state.players.self.scene.find(character => character.uid === 'kogoro');
  return {
    assist,
    declared,
    fileCount: state.players.self.file.length,
    opponentFileCount: state.players.opp.file.length,
    selfAssistedEntries: state.players.self.file.filter(entry => entry.type === 'assisted-partner').length,
    choices: continuation.choices,
    continuationSource: continuation.source,
    sourceArea: source ? 'scene' : state.players.self.remove.includes(row.cardId) ? 'remove' : 'missing',
    sourceState: source?.state ?? null,
    sourceUseCount: source
      ? readChar.declaredUseCount(state, 'source', row.abilityId, {
        abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
      })
      : null,
    sourceAp: source ? readChar.ap(state, 'source') : null,
    sourceAssault: source ? readChar.hasKeyword(state, 'source', '突撃') : false,
    sourceAssaultCase: source ? readChar.hasKeyword(state, 'source', '突撃[事件]') : false,
    sourceAssaultChar: source ? readChar.hasKeyword(state, 'source', '突撃[キャラ]') : false,
    haibaraState: state.players.self.scene.find(character => character.uid === 'haibara')?.state ?? null,
    kogoroAssault: kogoro ? readChar.hasKeyword(state, 'kogoro', '突撃') : false,
    redEntryScene: state.players.self.scene.some(character => character.cardId === RED_ENTRY),
    dualScene: state.players.self.scene.some(character => character.cardId === DUAL),
    hand: [...state.players.self.hand],
    remove: [...state.players.self.remove].sort(),
    ordinaryFileRemoved: state.players.self.remove.filter(cardId => cardId.startsWith(`${row.cardId}-SELF-FILE`)).length,
    settled: !useGameStateStore.getState().pendingEffectChoice && !useGameStateStore.getState().pendingEffectPick,
  };
}

function prove(row: Row) {
  return {
    cardId: row.cardId,
    below: run(row, row.threshold - 2),
    exact: run(row, row.threshold - 1),
    ...(row.cardId === 'B08007'
      ? { exactWithoutStack: run(row, row.threshold - 1, false) }
      : {}),
  };
}

function rejectedVariant(row: Row, label: string, mutateState: (state: GameState) => void) {
  const state = stateFor(row, row.threshold - 1);
  mutateState(state);
  installPrepared(state, `qa-w42-${row.cardId}-${label}`);
  const assist = dispatchEngineAction({ type: 'assist', player: 'self' }).ok;
  const before = JSON.stringify(current().players.self);
  const declared = dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: row.abilityId,
    costParams: row.costParams,
  }).ok;
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  return {
    assist,
    declared,
    unchanged: JSON.stringify(current().players.self) === before,
    decisions: [store.pendingEffectChoice, store.pendingEffectPick].filter(Boolean).length,
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  [
    character(RED_PARTNER, { kind: 'partner', colors: ['赤'] }),
    character(RED_ENTRY, { colors: ['赤'], level: 7 }),
    character(HAIBARA, { names: ['灰原哀'] }),
    character(HAND_COST),
    character(DUAL, { names: ['赤井秀一&世良真純', '赤井秀一', '世良真純'], colors: ['赤'], level: 9 }),
    character(BOTH_TRAITS, { traits: ['FBI', '赤井家'] }),
    character(STUDENT, { traits: ['高校生'] }),
    character(KOGORO, { names: ['毛利小五郎'], lp: 0 }),
    character(BLACK_A, { colors: ['黒'] }),
    character(BLACK_B, { colors: ['黒'] }),
    character(BLACK_C, { colors: ['黒'] }),
    character(DECOY),
  ].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.getState().setGameState(null);
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave42: remaining declared FILE conditions count the assisting partner', () => {
  it('B07069 enables exact FILE8 payment, preserves the partner, and enters its cost card', () => {
    expect(B07069P.abilities).toEqual(B07069.abilities);
    expect(prove(ROWS[0]!)).toEqual({
      cardId: 'B07069',
      below: { assist: true, declared: false, fileCount: 7, opponentFileCount: 8, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'active', sourceUseCount: 0, sourceAp: 7000, sourceAssault: false, sourceAssaultCase: false, sourceAssaultChar: false, haibaraState: null, kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [RED_ENTRY], remove: [], ordinaryFileRemoved: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 7, opponentFileCount: 8, selfAssistedEntries: 1, choices: ['pick'], continuationSource: 'B07069', sourceArea: 'scene', sourceState: 'sleep', sourceUseCount: 1, sourceAp: 7000, sourceAssault: false, sourceAssaultCase: false, sourceAssaultChar: false, haibaraState: null, kogoroAssault: false, redEntryScene: true, dualScene: false, hand: [], remove: ['B07069-SELF-FILE-6'], ordinaryFileRemoved: 1, settled: true },
    });
  });

  it('B08004 enables exact FILE5 stun cost and reactivates itself', () => {
    expect(prove(ROWS[1]!)).toEqual({
      cardId: 'B08004',
      below: { assist: true, declared: false, fileCount: 4, opponentFileCount: 5, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'sleep', sourceUseCount: 0, sourceAp: 6000, sourceAssault: true, sourceAssaultCase: false, sourceAssaultChar: false, haibaraState: 'active', kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [], remove: [BLACK_A, BLACK_B, BLACK_C].sort(), ordinaryFileRemoved: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 5, opponentFileCount: 5, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'active', sourceUseCount: 1, sourceAp: 6000, sourceAssault: true, sourceAssaultCase: false, sourceAssaultChar: false, haibaraState: 'stun', kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [], remove: [BLACK_A, BLACK_B, BLACK_C].sort(), ordinaryFileRemoved: 0, settled: true },
    });
  });

  it('B08007 enables exact FILE5 hand cost only with three stacked cards', () => {
    expect(prove(ROWS[2]!)).toEqual({
      cardId: 'B08007',
      below: { assist: true, declared: false, fileCount: 4, opponentFileCount: 5, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'sleep', sourceUseCount: 0, sourceAp: 8000, sourceAssault: false, sourceAssaultCase: true, sourceAssaultChar: true, haibaraState: null, kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [HAND_COST], remove: [], ordinaryFileRemoved: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 5, opponentFileCount: 5, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'active', sourceUseCount: 1, sourceAp: 8000, sourceAssault: false, sourceAssaultCase: true, sourceAssaultChar: true, haibaraState: null, kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [], remove: [HAND_COST], ordinaryFileRemoved: 0, settled: true },
      exactWithoutStack: { assist: true, declared: false, fileCount: 5, opponentFileCount: 5, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'sleep', sourceUseCount: 0, sourceAp: 7000, sourceAssault: false, sourceAssaultCase: true, sourceAssaultChar: false, haibaraState: null, kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [HAND_COST], remove: [], ordinaryFileRemoved: 0, settled: true },
    });
  });

  it('B09055 enables exact FILE8 dual-card cost and union-source entry', () => {
    expect(prove(ROWS[3]!)).toEqual({
      cardId: 'B09055',
      below: { assist: true, declared: false, fileCount: 7, opponentFileCount: 8, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'active', sourceUseCount: 0, sourceAp: 7000, sourceAssault: false, sourceAssaultCase: false, sourceAssaultChar: false, haibaraState: null, kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [DUAL], remove: [], ordinaryFileRemoved: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 8, opponentFileCount: 8, selfAssistedEntries: 1, choices: ['pick'], continuationSource: 'B09055', sourceArea: 'remove', sourceState: null, sourceUseCount: null, sourceAp: null, sourceAssault: false, sourceAssaultCase: false, sourceAssaultChar: false, haibaraState: null, kogoroAssault: false, redEntryScene: false, dualScene: true, hand: [], remove: ['B09055'], ordinaryFileRemoved: 0, settled: true },
    });
  });

  it('B09060 enables exact FILE7 dual-trait cost and both AP/assault branches', () => {
    expect(prove(ROWS[4]!)).toEqual({
      cardId: 'B09060',
      below: { assist: true, declared: false, fileCount: 6, opponentFileCount: 7, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'active', sourceUseCount: 0, sourceAp: 4000, sourceAssault: false, sourceAssaultCase: false, sourceAssaultChar: false, haibaraState: null, kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [BOTH_TRAITS], remove: [], ordinaryFileRemoved: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 7, opponentFileCount: 7, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'active', sourceUseCount: 1, sourceAp: 6000, sourceAssault: false, sourceAssaultCase: true, sourceAssaultChar: true, haibaraState: null, kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [], remove: [BOTH_TRAITS], ordinaryFileRemoved: 0, settled: true },
    });
  });

  it.each([
    ['PR179', ROWS[5]],
    ['PR185', ROWS[6]],
  ] as const)('%s enables exact FILE7 reveal cost without moving the hand card', (cardId, row) => {
    expect(prove(row!)).toEqual({
      cardId,
      below: { assist: true, declared: false, fileCount: 6, opponentFileCount: 7, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'active', sourceUseCount: 0, sourceAp: 4000, sourceAssault: false, sourceAssaultCase: false, sourceAssaultChar: false, haibaraState: null, kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [STUDENT, DECOY], remove: [], ordinaryFileRemoved: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 7, opponentFileCount: 7, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'active', sourceUseCount: 1, sourceAp: 6000, sourceAssault: true, sourceAssaultCase: false, sourceAssaultChar: false, haibaraState: null, kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [STUDENT, DECOY], remove: [], ordinaryFileRemoved: 0, settled: true },
    });
  });

  it.each([
    ['PR199', ROWS[7]],
    ['PR205', ROWS[8]],
  ] as const)('%s enables exact FILE5 choice and grants assault to LP0 Kogoro', (cardId, row) => {
    expect(prove(row!)).toEqual({
      cardId,
      below: { assist: true, declared: false, fileCount: 4, opponentFileCount: 5, selfAssistedEntries: 1, choices: [], continuationSource: null, sourceArea: 'scene', sourceState: 'active', sourceUseCount: 0, sourceAp: 5000, sourceAssault: false, sourceAssaultCase: false, sourceAssaultChar: false, haibaraState: null, kogoroAssault: false, redEntryScene: false, dualScene: false, hand: [], remove: [], ordinaryFileRemoved: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 5, opponentFileCount: 5, selfAssistedEntries: 1, choices: ['choice', 'pick'], continuationSource: cardId, sourceArea: 'scene', sourceState: 'sleep', sourceUseCount: 1, sourceAp: 5000, sourceAssault: false, sourceAssaultCase: false, sourceAssaultChar: false, haibaraState: null, kogoroAssault: true, redEntryScene: false, dualScene: false, hand: [], remove: [], ordinaryFileRemoved: 0, settled: true },
    });
  });

  it('keeps B08004 blocked at exact FILE5 when its case or remove-character gate is missing', () => {
    expect({
      wrongCase: rejectedVariant(ROWS[1]!, 'wrong-case', state => {
        state.players.self.case.colors = ['青'];
      }),
      insufficientBlackCharacters: rejectedVariant(ROWS[1]!, 'low-remove', state => {
        state.players.self.remove = [BLACK_A, BLACK_B, DECOY];
      }),
      missingBondAndCostWitness: rejectedVariant(ROWS[1]!, 'no-haibara', state => {
        state.players.self.scene = state.players.self.scene.filter(character => character.uid !== 'haibara');
      }),
    }).toEqual({
      wrongCase: { assist: true, declared: false, unchanged: true, decisions: 0 },
      insufficientBlackCharacters: { assist: true, declared: false, unchanged: true, decisions: 0 },
      missingBondAndCostWitness: { assist: true, declared: false, unchanged: true, decisions: 0 },
    });
  });

  it('keeps B09055 blocked at exact FILE8 without its red partner', () => {
    expect(rejectedVariant(ROWS[3]!, 'wrong-partner', state => {
      state.players.self.partner.cardId = BLUE_PARTNER;
    })).toEqual({ assist: true, declared: false, unchanged: true, decisions: 0 });
  });

  it.each([
    ['B07069', ROWS[0]],
    ['B09055', ROWS[3]],
  ] as const)('%s rejects an incomplete composite cost without partial sleep or FILE payment', (_cardId, row) => {
    expect(rejectedVariant(row!, 'missing-hand-cost', state => {
      state.players.self.hand = [];
    })).toEqual({ assist: true, declared: false, unchanged: true, decisions: 0 });
  });

  it.each([
    ['PR179', ROWS[5]],
    ['PR185', ROWS[6]],
  ] as const)('%s rejects exact FILE7 without a high-school reveal-cost card', (_cardId, row) => {
    expect(rejectedVariant(row!, 'no-student', state => {
      state.players.self.hand = [DECOY];
    })).toEqual({ assist: true, declared: false, unchanged: true, decisions: 0 });
  });

  it.each(ROWS.filter(row => row.cardId !== 'B09055'))(
    '$cardId rejects a second exact-threshold use before touching costs or decisions',
    (row) => {
      expect(rejectedVariant(row, 'turn-limit', state => {
        state.players.self.scene.find(character => character.uid === 'source')!.declaredUseCount = {
          [row.abilityId]: 1,
        };
      })).toEqual({ assist: true, declared: false, unchanged: true, decisions: 0 });
    },
  );
});
