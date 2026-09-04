// qa: card:B06095:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2
// qa: card:B09111:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2
// qa: card:B09112:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2
// qa: card:B10082:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2
// qa: card:B10101:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2
// qa: card:B10102:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2

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

const FURUYA = 'W37_FURUYA';
const DECOY = 'W37_DECOY';
const DRAW = 'W37_DRAW';
const SPARE = 'W37_SPARE';

type Row = {
  cardId: 'B06095' | 'B09111' | 'B09112' | 'B10082' | 'B10101' | 'B10102';
  setup: (state: GameState) => void;
  declaredName?: string;
  expectedSelfRemove: string[];
  expectedOppRemove: string[];
  expectedOppFile: string[];
};

const ROWS: Row[] = [
  { cardId: 'B06095', setup: () => undefined, expectedSelfRemove: [], expectedOppRemove: [], expectedOppFile: [] },
  {
    cardId: 'B09111',
    setup: state => {
      state.players.opp.file = [{ type: 'card-back', cardId: DECOY }];
      state.players.opp.deck = [DRAW, SPARE];
    },
    declaredName: '工藤新一',
    expectedSelfRemove: [],
    expectedOppRemove: [DECOY],
    expectedOppFile: [DRAW],
  },
  {
    cardId: 'B09112',
    setup: () => undefined,
    declaredName: '工藤新一',
    expectedSelfRemove: [], expectedOppRemove: [], expectedOppFile: [],
  },
  {
    cardId: 'B10082',
    setup: state => {
      state.players.self.scene = [sceneChar(FURUYA, 'furuya')];
      state.players.self.deck = [DECOY, DRAW];
    },
    expectedSelfRemove: [DECOY, DRAW].sort(), expectedOppRemove: [], expectedOppFile: [],
  },
  { cardId: 'B10101', setup: () => undefined, expectedSelfRemove: [], expectedOppRemove: [], expectedOppFile: [] },
  { cardId: 'B10102', setup: () => undefined, expectedSelfRemove: [], expectedOppRemove: [], expectedOppFile: [] },
];

function fixtureCharacter(id: string, names: string[]): CardDef {
  return {
    id, no: id, kind: 'character', names, colors: ['青'], traits: [],
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
    cardId: `W37_EVIDENCE_${index}`,
    faceUp: false,
    origin: { turn: 1, via: 'reasoning' as const },
  }));
  state.players.opp.evidence = Array.from({ length: 2 }, (_value, index) => ({
    cardId: `W37_OPP_EVIDENCE_${index}`,
    faceUp: false,
    origin: { turn: 1, via: 'reasoning' as const },
  }));
  state.players.self.scene = [];
  state.players.self.hand = [];
  state.players.self.remove = [];
  state.players.self.deck = [];
  state.players.opp.file = [];
  state.players.opp.remove = [];
  state.players.opp.deck = [];
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
  if (!state) throw new Error('missing Wave37 state');
  return state;
}

function dispatch(row: Row, evidenceIndices: number[]): ReturnType<typeof dispatchEngineAction> {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: 'case:self',
    abilId: 'a2',
    costParams: {
      flipFaceUpEvidence: { indices: evidenceIndices },
      ...(row.declaredName ? { declaredName: row.declaredName } : {}),
    },
  });
}

function settlePublicTail(): void {
  for (let step = 0; step < 6; step += 1) {
    const store = useGameStateStore.getState();
    if (store.pendingEffectPick) {
      expect(dispatchEngineAction(bindPendingDecision(store.pendingEffectPick, {
        type: 'effectPickResolve', pickedUid: null,
      }))).toEqual({ ok: true });
      continue;
    }
    if (store.pendingEffectOptional) {
      expect(dispatchEngineAction(bindPendingDecision(store.pendingEffectOptional, {
        type: 'effectOptionalResolve', run: false,
      }))).toEqual({ ok: true });
      continue;
    }
    if (store.pendingDeckReorder) {
      expect(dispatchEngineAction(bindPendingDecision(store.pendingDeckReorder, {
        type: 'deckReorderResolve', order: [...store.pendingDeckReorder.cardIds],
      }))).toEqual({ ok: true });
      continue;
    }
    break;
  }
  if (useGameStateStore.getState().pendingDeckReveal) {
    useGameStateStore.getState().setPendingDeckReveal(null);
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
  ].filter(entry => Boolean(entry[1])).map(entry => entry[0] as string);
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
    selfRemove: [...after.players.self.remove].sort(),
    oppRemove: [...after.players.opp.remove].sort(),
    oppFile: after.players.opp.file.map(entry => entry.cardId),
    selfDeck: [...after.players.self.deck].sort(),
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
  register(fixtureCharacter(FURUYA, ['降谷零']));
  register(fixtureCharacter(DECOY, ['対象外']));
  register(fixtureCharacter(DRAW, ['補充札']));
  register(fixtureCharacter(SPARE, ['予備札']));
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave37: complex case cards retain the shared self-only flip-two contract', () => {
  it(`card:B06095:${ROWS[0]!.cardId}`, () => {
    expect(prove(ROWS[0]!)).toEqual({
      cardId: 'B06095', ...COMMON_COST_EXPECTATION,
      selfRemove: [], oppRemove: [], oppFile: [], selfDeck: [],
    });
  });

  it(`card:B09111:${ROWS[1]!.cardId}`, () => {
    expect(prove(ROWS[1]!)).toEqual({
      cardId: 'B09111', ...COMMON_COST_EXPECTATION,
      selfRemove: [], oppRemove: [DECOY], oppFile: [DRAW], selfDeck: [],
    });
  });

  it(`card:B09112:${ROWS[2]!.cardId}`, () => {
    expect(prove(ROWS[2]!)).toEqual({
      cardId: 'B09112', ...COMMON_COST_EXPECTATION,
      selfRemove: [], oppRemove: [], oppFile: [], selfDeck: [],
    });
  });

  it(`card:B10082:${ROWS[3]!.cardId}`, () => {
    expect(prove(ROWS[3]!)).toEqual({
      cardId: 'B10082', ...COMMON_COST_EXPECTATION,
      selfRemove: [], oppRemove: [], oppFile: [], selfDeck: [DECOY, DRAW].sort(),
    });
  });

  it(`card:B10101:${ROWS[4]!.cardId}`, () => {
    expect(prove(ROWS[4]!)).toEqual({
      cardId: 'B10101', ...COMMON_COST_EXPECTATION,
      selfRemove: [], oppRemove: [], oppFile: [], selfDeck: [],
    });
  });

  it(`card:B10102:${ROWS[5]!.cardId}`, () => {
    expect(prove(ROWS[5]!)).toEqual({
      cardId: 'B10102', ...COMMON_COST_EXPECTATION,
      selfRemove: [], oppRemove: [], oppFile: [], selfDeck: [],
    });
  });
});

// Wave53 exact one-facedown-evidence-insufficient bindings.
// qa: card:B06095:324a24588d4bb1ddbf561b347a12dcb2d77569ebb134f8d747e7ca53c6a9f570
// qa: card:B09111:324a24588d4bb1ddbf561b347a12dcb2d77569ebb134f8d747e7ca53c6a9f570
// qa: card:B09112:324a24588d4bb1ddbf561b347a12dcb2d77569ebb134f8d747e7ca53c6a9f570
// qa: card:B10082:324a24588d4bb1ddbf561b347a12dcb2d77569ebb134f8d747e7ca53c6a9f570
// qa: card:B10101:324a24588d4bb1ddbf561b347a12dcb2d77569ebb134f8d747e7ca53c6a9f570
// qa: card:B10102:324a24588d4bb1ddbf561b347a12dcb2d77569ebb134f8d747e7ca53c6a9f570

describe('Wave53 complex cases reject one facedown evidence transactionally', () => {
  it.each(ROWS)('$cardId rejects one down, then accepts nonadjacent exact-two payment', row => {
    const state = baseState(row, '解決編', 2);
    state.players.self.evidence[1]!.faceUp = true;
    install(state, `${row.cardId}:wave53-mixed-recovery`);
    const before = current();
    const beforeJson = JSON.stringify(before);

    // Card-bound rows: B06095 B09111 B09112 B10082 B10101 B10102.
    expect(dispatch(row, [0]), `${row.cardId}: one facedown evidence rejects`)
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(current(), `${row.cardId}: rejected state reference`).toBe(before);
    expect(JSON.stringify(current()), `${row.cardId}: rejected state semantics`).toBe(beforeJson);
    expect(openDecisionKinds(), `${row.cardId}: rejected decision surface`).toEqual([]);

    const recovered = JSON.parse(JSON.stringify(current())) as GameState;
    recovered.players.self.evidence.push({
      cardId: `W37_RECOVERY_${row.cardId}`, faceUp: false,
      origin: { turn: recovered.turn.number, via: 'effect' },
    });
    expect(useGameStateStore.getState().setGameState(recovered)).toBe(true);
    expect(dispatch(row, [0, 2]), `${row.cardId}: nonadjacent two facedown evidence accepts`)
      .toEqual({ ok: true });
    settlePublicTail();
    expect(current().players.self.evidence.map(entry => entry.faceUp), `${row.cardId}: exact self payment`)
      .toEqual([true, true, true]);
    expect(current().players.opp.evidence.every(entry => !entry.faceUp), `${row.cardId}: opponent evidence isolated`)
      .toBe(true);
    expect(readChar.declaredUseCount(current(), 'case:self', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    }), `${row.cardId}: rejected attempt did not consume turn use`).toBe(1);
  });
});
