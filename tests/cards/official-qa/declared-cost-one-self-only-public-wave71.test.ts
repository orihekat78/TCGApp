// qa: card:B07061:5ec9d86e896c25749cf5aab043bd9fa0c92af21362e720fe60944e7adeb237c6
// qa: card:B07077:5ec9d86e896c25749cf5aab043bd9fa0c92af21362e720fe60944e7adeb237c6
// qa: card:B08030:5ec9d86e896c25749cf5aab043bd9fa0c92af21362e720fe60944e7adeb237c6
// qa: card:B08044:5ec9d86e896c25749cf5aab043bd9fa0c92af21362e720fe60944e7adeb237c6
// qa: card:D08005:5ec9d86e896c25749cf5aab043bd9fa0c92af21362e720fe60944e7adeb237c6
// qa: card:D08006:5ec9d86e896c25749cf5aab043bd9fa0c92af21362e720fe60944e7adeb237c6
// Rules: 21-declared-ability-cost. A colon-left cost uses only its owner evidence.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyMove } from '@/ai/policy';
import { enumerateMoves } from '@/ai/move-enumerator';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type BaseId = 'B07061' | 'B07077' | 'B08030' | 'B08044' | 'D08005' | 'D08006';
type Row = { cardId: string; baseId: BaseId; kind: 'case' | 'character' };

const PRINTINGS: Row[] = [
  { cardId: 'B07061', baseId: 'B07061', kind: 'case' },
  { cardId: 'B07061P', baseId: 'B07061', kind: 'case' },
  { cardId: 'B07077', baseId: 'B07077', kind: 'case' },
  { cardId: 'B07077P', baseId: 'B07077', kind: 'case' },
  { cardId: 'B08030', baseId: 'B08030', kind: 'case' },
  { cardId: 'B08030P', baseId: 'B08030', kind: 'case' },
  { cardId: 'B08044', baseId: 'B08044', kind: 'case' },
  { cardId: 'B08044P', baseId: 'B08044', kind: 'case' },
  { cardId: 'D08005', baseId: 'D08005', kind: 'character' },
  { cardId: 'D08006', baseId: 'D08006', kind: 'character' },
];

const FBI = 'W71-FBI';
const MOMIJI = 'W71-MOMIJI';
const OWN_A = 'W71-OWN-A';
const OWN_B = 'W71-OWN-B';
const OWN_C = 'W71-OWN-C';
const OPP_A = 'W71-OPP-A';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3,
    ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function evidence(cardId: string, faceUp = false, turn = 1) {
  return { cardId, faceUp, origin: { turn, via: 'effect' as const } };
}

function sourceUid(row: Row, owner: Player): string {
  return row.kind === 'case' ? `case:${owner}` : `${owner}-${row.cardId}-source`;
}

function satisfyPrintedCondition(row: Row, state: GameState, owner: Player): void {
  if (row.baseId === 'B07077') {
    state.players[owner].scene = [sceneChar(FBI, `${owner}-fbi`)];
  } else if (row.baseId === 'B08030') {
    state.players[owner].scene = [sceneChar(MOMIJI, `${owner}-momiji`)];
  } else if (row.kind === 'character') {
    state.players[owner].scene = [sceneChar(row.cardId, sourceUid(row, owner))];
  }
}

function stateFor(row: Row, owner: Player, ownerFaces: boolean[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 9, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  if (row.kind === 'case') {
    state.players[owner].case = {
      ...state.players[owner].case,
      cardId: row.cardId,
      status: '解決編',
      declaredUseCount: {},
    };
  }
  state.players[owner].evidence = ownerFaces.map((faceUp, index) => (
    evidence([OWN_A, OWN_B, OWN_C][index]!, faceUp, index + 1)
  ));
  state.players[other(owner)].evidence = [evidence(OPP_A, false, 7)];
  satisfyPrintedCondition(row, state, owner);
  return state;
}

function install(state: GameState, label: string, human: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave71 state');
  return state;
}

function dispatch(row: Row, owner: Player, indices: number[]) {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: sourceUid(row, owner),
    abilId: 'a2',
    abilityOrigin: 'printed',
    abilityIndex: 1,
    costParams: { flipFaceUpEvidence: { indices } },
  });
}

function moveFor(state: GameState, row: Row, owner: Player) {
  return enumerateMoves(state, owner).find(candidate => (
    candidate.kind === 'declaredAbility'
    && candidate.uid === sourceUid(row, owner)
    && candidate.abilityId === 'a2'
  ));
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  register(fixture(FBI, { traits: ['FBI'] }));
  register(fixture(MOMIJI, { names: ['大岡紅葉'] }));
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave71: B07061/P B07077/P B08030/P B08044/P D08005 D08006 use only owner evidence', () => {
  it.each(PRINTINGS)('$cardId flips the selected non-top owner occurrence only', row => {
    const state = stateFor(row, 'self', [true, false, false]);
    const identity = state.players.self.evidence.map(({ cardId, origin }) => ({ cardId, origin }));
    const opponent = JSON.parse(JSON.stringify(state.players.opp.evidence));
    install(state, `${row.cardId}:wave71-positive`, 'self');

    expect(dispatch(row, 'self', [2])).toEqual({ ok: true });
    expect(current().players.self.evidence.map(({ cardId, origin }) => ({ cardId, origin })))
      .toEqual(identity);
    expect(current().players.self.evidence.map(entry => entry.faceUp)).toEqual([true, false, true]);
    expect(current().players.opp.evidence).toEqual(opponent);
    expect(readChar.declaredUseCount(current(), sourceUid(row, 'self'), 'a2', {
      abilityOrigin: 'printed',
      abilityIndex: 1,
    })).toBe(1);
  });

  it.each(PRINTINGS)('$cardId cannot replace missing owner payment with opponent evidence', row => {
    const state = stateFor(row, 'self', [true]);
    install(state, `${row.cardId}:wave71-opponent-only`, 'self');
    const before = current();
    const beforeJson = JSON.stringify(before);

    expect(dispatch(row, 'self', [0])).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
    expect(current().players.self.evidence.map(entry => entry.faceUp)).toEqual([true]);
    expect(current().players.opp.evidence.map(entry => entry.faceUp)).toEqual([false]);
  });

  it.each(PRINTINGS)('$cardId resolves the same exact owner-relative cost for owner opp', row => {
    const state = stateFor(row, 'opp', [true, false, false]);
    const selfEvidence = JSON.parse(JSON.stringify(state.players.self.evidence));
    install(state, `${row.cardId}:wave71-owner-opp`, 'opp');

    expect(dispatch(row, 'opp', [1])).toEqual({ ok: true });
    expect(current().players.opp.evidence.map(entry => entry.faceUp)).toEqual([true, true, false]);
    expect(current().players.self.evidence).toEqual(selfEvidence);
  });

  it.each(PRINTINGS)('$cardId rejects malformed owner selections atomically', row => {
    const state = stateFor(row, 'self', [true, false, false]);
    install(state, `${row.cardId}:wave71-malformed`, 'self');
    const attempts = [
      { label: 'zero', indices: [] },
      { label: 'two', indices: [1, 2] },
      { label: 'duplicate', indices: [1, 1] },
      { label: 'out-of-range', indices: [99] },
      { label: 'face-up', indices: [0] },
    ];

    for (const attempt of attempts) {
      const before = current();
      const beforeJson = JSON.stringify(before);
      expect(dispatch(row, 'self', attempt.indices), attempt.label)
        .toEqual({ ok: false, reason: 'not-allowed' });
      expect(current(), attempt.label).toBe(before);
      expect(JSON.stringify(current()), attempt.label).toBe(beforeJson);
    }
  });

  it.each(PRINTINGS)('$cardId is not enumerated for CPU from opponent evidence alone', row => {
    const state = stateFor(row, 'opp', [true]);

    expect(moveFor(state, row, 'opp')).toBeUndefined();
    expect(state.players.opp.evidence.map(entry => entry.faceUp)).toEqual([true]);
    expect(state.players.self.evidence.map(entry => entry.faceUp)).toEqual([false]);
  });

  it.each([
    { cardId: 'B07061P', baseId: 'B07061', kind: 'case' },
    { cardId: 'D08006', baseId: 'D08006', kind: 'character' },
  ] as const)('$cardId CPU pays from its own evidence and resolves', row => {
    const state = stateFor(row, 'opp', [true, false]);
    const move = moveFor(state, row, 'opp');
    expect(move).toBeTruthy();

    const after = produce(state, draft => {
      applyMove(draft, move!, 'opp');
      runAllUntilEmpty(draft);
    });
    expect(after.players.opp.evidence.map(entry => entry.faceUp)).toEqual([true, true]);
    expect(after.players.self.evidence.map(entry => entry.faceUp)).toEqual([false]);
  });

  it.each([
    { cardId: 'B08044P', baseId: 'B08044', kind: 'case' },
    { cardId: 'D08006', baseId: 'D08006', kind: 'character' },
  ] as const)('$cardId committed owner payment survives save hydration', row => {
    install(stateFor(row, 'self', [true, false]), `${row.cardId}:wave71-save`, 'self');
    expect(dispatch(row, 'self', [1])).toEqual({ ok: true });
    const saved = JSON.parse(JSON.stringify(current())) as GameState;

    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    expect(current().players.self.evidence.map(entry => entry.faceUp)).toEqual([true, true]);
    expect(current().players.opp.evidence.map(entry => entry.faceUp)).toEqual([false]);
  });
});
