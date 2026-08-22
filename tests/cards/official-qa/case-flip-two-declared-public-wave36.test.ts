// qa: card:B06013:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2
// qa: card:B06065:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2
// qa: card:B07062:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2
// qa: card:B08094:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2
// qa: card:B10034:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2
// qa: card:D10026:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { startCausalSession } from '@/engine/log/causal';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const KUDO = 'W36_KUDO';
const KOIZUMI = 'W36_KOIZUMI';
const HAIBARA = 'W36_HAIBARA';
const POLICE_A = 'W36_POLICE_A';
const POLICE_B = 'W36_POLICE_B';
const DECOY = 'W36_DECOY';
const DRAW = 'W36_DRAW';

type Row = {
  cardId: 'B06013' | 'B06065' | 'B07062' | 'B08094' | 'B10034' | 'D10026';
  setup: (state: GameState) => void;
  choiceIndex?: number;
  expectedHand: string[];
};

const ROWS: Row[] = [
  {
    cardId: 'B06013',
    setup: state => {
      state.players.self.scene = [sceneChar(KUDO, 'kudo')];
      state.players.self.deck = [DECOY];
    },
    expectedHand: [],
  },
  { cardId: 'B06065', setup: () => undefined, expectedHand: [] },
  {
    cardId: 'B07062',
    setup: state => { state.players.self.scene = [sceneChar(KOIZUMI, 'koizumi')]; },
    expectedHand: [],
  },
  {
    cardId: 'B08094',
    setup: state => {
      state.players.self.scene = [sceneChar(HAIBARA, 'haibara')];
      state.players.self.deck = [DECOY];
    },
    expectedHand: [],
  },
  {
    cardId: 'B10034',
    setup: state => {
      state.players.self.scene = [sceneChar(POLICE_A, 'police-a'), sceneChar(POLICE_B, 'police-b')];
      state.players.self.deck = [DRAW];
    },
    expectedHand: [DRAW],
  },
  { cardId: 'D10026', setup: () => undefined, choiceIndex: 0, expectedHand: [] },
];

function fixtureCharacter(
  id: string,
  names: string[],
  colors: string[] = ['青'],
  traits: string[] = [],
): CardDef {
  return {
    id, no: id, kind: 'character', names, colors, traits,
    level: 3, ap: 3000, lp: 1, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function baseState(row: Row, status: '事件編' | '解決編', evidenceCount: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = {
    ...state.players.self.case,
    cardId: row.cardId,
    status,
    declaredUseCount: {},
  };
  state.players.self.evidence = Array.from({ length: evidenceCount }, (_value, index) => ({
    cardId: `W36_EVIDENCE_${index}`,
    faceUp: false,
    origin: { turn: 1, via: 'reasoning' as const },
  }));
  state.players.opp.evidence = Array.from({ length: 2 }, (_value, index) => ({
    cardId: `W36_OPP_EVIDENCE_${index}`,
    faceUp: false,
    origin: { turn: 1, via: 'reasoning' as const },
  }));
  state.players.self.hand = [];
  state.players.self.remove = [];
  state.players.self.deck = [];
  row.setup(state);
  return state;
}

function install(state: GameState, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave36 state');
  return state;
}

function dispatch(row: Row, evidenceIndices: number[]): ReturnType<typeof dispatchEngineAction> {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: 'case:self',
    abilId: 'a2',
    costParams: {
      flipFaceUpEvidence: { indices: evidenceIndices },
      ...(row.choiceIndex !== undefined ? { choiceIndex: row.choiceIndex } : {}),
    },
  });
}

function settlePublicTail(): void {
  const pick = useGameStateStore.getState().pendingEffectPick;
  if (pick) {
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
  }
  if (useGameStateStore.getState().pendingDeckReveal) {
    useGameStateStore.getState().setPendingDeckReveal(null);
  }
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  if (reorder) {
    expect(dispatchEngineAction(bindPendingDecision(reorder, {
      type: 'deckReorderResolve', order: [...reorder.cardIds],
    }))).toEqual({ ok: true });
  }
}

function openDecisionKinds(): string[] {
  const store = useGameStateStore.getState();
  return [
    ['choice', store.pendingEffectChoice],
    ['optional', store.pendingEffectOptional],
    ['pick', store.pendingEffectPick],
    ['deck-place', store.pendingDeckPlace],
    ['deck-reorder', store.pendingDeckReorder],
  ].filter((entry): entry is [string, NonNullable<unknown>] => Boolean(entry[1])).map(entry => entry[0]);
}

function costSnapshot(row: Row, ok: boolean) {
  const state = current();
  return {
    ok,
    selfEvidence: state.players.self.evidence.map(entry => entry.faceUp),
    opponentFaceUp: state.players.opp.evidence.filter(entry => entry.faceUp).length,
    used: readChar.declaredUseCount(state, 'case:self', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    }),
    openDecisions: openDecisionKinds(),
  };
}

function prove(row: Row) {
  install(baseState(row, '事件編', 2), `${row.cardId}:incident`);
  const incident = costSnapshot(row, dispatch(row, [0, 1]).ok);

  install(baseState(row, '解決編', 1), `${row.cardId}:insufficient`);
  const insufficient = costSnapshot(row, dispatch(row, [0]).ok);

  install(baseState(row, '解決編', 3), `${row.cardId}:overspecified`);
  const overspecified = costSnapshot(row, dispatch(row, [0, 1, 2]).ok);

  install(baseState(row, '解決編', 4), `${row.cardId}:accepted`);
  const acceptedOk = dispatch(row, [0, 1]).ok;
  settlePublicTail();
  const accepted = costSnapshot(row, acceptedOk);
  const repeated = costSnapshot(row, dispatch(row, [2, 3]).ok);
  const after = current();

  return {
    cardId: row.cardId,
    incident,
    insufficient,
    overspecified,
    accepted,
    repeated,
    hand: after.players.self.hand,
  };
}

const COMMON_COST_EXPECTATION = {
  incident: { ok: false, selfEvidence: [false, false], opponentFaceUp: 0, used: 0, openDecisions: [] },
  insufficient: { ok: false, selfEvidence: [false], opponentFaceUp: 0, used: 0, openDecisions: [] },
  overspecified: { ok: false, selfEvidence: [false, false, false], opponentFaceUp: 0, used: 0, openDecisions: [] },
  accepted: { ok: true, selfEvidence: [true, true, false, false], opponentFaceUp: 0, used: 1, openDecisions: [] },
  repeated: { ok: false, selfEvidence: [true, true, false, false], opponentFaceUp: 0, used: 1, openDecisions: [] },
};

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  register(fixtureCharacter(KUDO, ['工藤新一']));
  register(fixtureCharacter(KOIZUMI, ['小泉紅子']));
  register(fixtureCharacter(HAIBARA, ['灰原哀']));
  register(fixtureCharacter(POLICE_A, ['警察A'], ['緑'], ['警察']));
  register(fixtureCharacter(POLICE_B, ['警察B'], ['緑'], ['警察']));
  register(fixtureCharacter(DECOY, ['対象外']));
  register(fixtureCharacter(DRAW, ['ドロー札']));
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave36: resolved cases pay exactly two facedown evidence', () => {
  it(`card:B06013:${ROWS[0]!.cardId}`, () => {
    expect(prove(ROWS[0]!)).toEqual({
      cardId: 'B06013', ...COMMON_COST_EXPECTATION, hand: [],
    });
  });

  it(`card:B06065:${ROWS[1]!.cardId}`, () => {
    expect(prove(ROWS[1]!)).toEqual({
      cardId: 'B06065', ...COMMON_COST_EXPECTATION, hand: [],
    });
  });

  it(`card:B07062:${ROWS[2]!.cardId}`, () => {
    expect(prove(ROWS[2]!)).toEqual({
      cardId: 'B07062', ...COMMON_COST_EXPECTATION, hand: [],
    });
  });

  it(`card:B08094:${ROWS[3]!.cardId}`, () => {
    expect(prove(ROWS[3]!)).toEqual({
      cardId: 'B08094', ...COMMON_COST_EXPECTATION, hand: [],
    });
  });

  it(`card:B10034:${ROWS[4]!.cardId}`, () => {
    expect(prove(ROWS[4]!)).toEqual({
      cardId: 'B10034', ...COMMON_COST_EXPECTATION, hand: [DRAW],
    });
  });

  it(`card:D10026:${ROWS[5]!.cardId}`, () => {
    expect(prove(ROWS[5]!)).toEqual({
      cardId: 'D10026', ...COMMON_COST_EXPECTATION, hand: [],
    });
  });
});
