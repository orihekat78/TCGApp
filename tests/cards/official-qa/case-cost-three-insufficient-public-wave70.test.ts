// qa: card:B05024:b2045bb3864646d52adf7eba7fd632862301fe361dfc43c09ef5282f07942610
// qa: card:B05063:b2045bb3864646d52adf7eba7fd632862301fe361dfc43c09ef5282f07942610
// qa: card:B05083:b2045bb3864646d52adf7eba7fd632862301fe361dfc43c09ef5282f07942610
// qa: card:B06036:b2045bb3864646d52adf7eba7fd632862301fe361dfc43c09ef5282f07942610
// qa: card:B06105:b2045bb3864646d52adf7eba7fd632862301fe361dfc43c09ef5282f07942610
// qa: card:D09027:b2045bb3864646d52adf7eba7fd632862301fe361dfc43c09ef5282f07942610
// Rules: 21-declared-ability-cost. Exact-three costs cannot be partially paid.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type BaseId = 'B05024' | 'B05063' | 'B05083' | 'B06036' | 'B06105' | 'D09027';
type Row = { cardId: string; baseId: BaseId };

const PRINTINGS: Row[] = [
  { cardId: 'B05024', baseId: 'B05024' },
  { cardId: 'B05024P', baseId: 'B05024' },
  { cardId: 'B05063', baseId: 'B05063' },
  { cardId: 'B05063P', baseId: 'B05063' },
  { cardId: 'B05083', baseId: 'B05083' },
  { cardId: 'B05083P', baseId: 'B05083' },
  { cardId: 'B06036', baseId: 'B06036' },
  { cardId: 'B06036P', baseId: 'B06036' },
  { cardId: 'B06105', baseId: 'B06105' },
  { cardId: 'B06105P', baseId: 'B06105' },
  { cardId: 'D09027', baseId: 'D09027' },
];

const SUZUKI = 'W70-SUZUKI';
const AKAI = 'W70-AKAI';
const OWN_A = 'W70-OWN-A';
const OWN_B = 'W70-OWN-B';
const OWN_C = 'W70-OWN-C';
const OPP_A = 'W70-OPP-A';
const OPP_B = 'W70-OPP-B';
const OPP_C = 'W70-OPP-C';

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

function satisfyPrintedCondition(row: Row, state: GameState, owner: Player): void {
  if (row.baseId === 'B05063') {
    state.players[owner].scene = [0, 1, 2].map(index => (
      sceneChar(SUZUKI, `${owner}-suzuki-${index}`)
    ));
  } else if (row.baseId === 'B05083') {
    state.players[owner].scene = [0, 1, 2].map(index => (
      sceneChar(AKAI, `${owner}-akai-${index}`)
    ));
    state.players[owner].file = [];
  }
}

function stateFor(row: Row, owner: Player, ownerFaces: boolean[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 8, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case,
    cardId: row.cardId,
    status: '解決編',
    declaredUseCount: {},
  };
  state.players[owner].evidence = ownerFaces.map((faceUp, index) => (
    evidence([OWN_A, OWN_B, OWN_C][index]!, faceUp, index + 1)
  ));
  state.players[other(owner)].evidence = [
    evidence(OPP_A, false, 4),
    evidence(OPP_B, false, 5),
    evidence(OPP_C, false, 6),
  ];
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
  if (!state) throw new Error('missing Wave70 state');
  return state;
}

function dispatch(indices: number[]) {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: `case:${current().turn.player}`,
    abilId: 'a2',
    abilityOrigin: 'printed',
    abilityIndex: 1,
    costParams: { flipFaceUpEvidence: { indices } },
  });
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  register(fixture(SUZUKI, { traits: ['鈴木財閥'] }));
  register(fixture(AKAI, { traits: ['赤井家'] }));
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave70: B05024/P B05063/P B05083/P B06036/P B06105/P D09027 reject incomplete payment', () => {
  it.each(PRINTINGS)('$cardId cannot use its ability by flipping all two own facedown evidence', row => {
    const state = stateFor(row, 'self', [false, false]);
    install(state, `${row.cardId}:wave70-two`, 'self');
    const before = current();
    const beforeJson = JSON.stringify(before);

    expect(dispatch([0, 1])).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
    expect(current().players.opp.evidence.map(entry => entry.faceUp)).toEqual([false, false, false]);
    expect(readChar.declaredUseCount(current(), 'case:self', 'a2', {
      abilityOrigin: 'printed',
      abilityIndex: 1,
    })).toBe(0);
  });

  it.each(PRINTINGS)('$cardId cannot supplement two own cards with opponent evidence', row => {
    const state = stateFor(row, 'self', [false, false]);
    install(state, `${row.cardId}:wave70-no-substitute`, 'self');
    const before = current();

    expect(dispatch([0, 1, 2])).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(current().players.self.evidence.map(entry => entry.faceUp)).toEqual([false, false]);
    expect(current().players.opp.evidence.map(entry => entry.faceUp)).toEqual([false, false, false]);
  });

  it.each(PRINTINGS)('$cardId rejects zero facedown owner evidence despite three opponent cards', row => {
    const state = stateFor(row, 'self', [true, true, true]);
    install(state, `${row.cardId}:wave70-zero`, 'self');
    const before = current();

    expect(dispatch([0, 1, 2])).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(current().players.opp.evidence.map(entry => entry.faceUp)).toEqual([false, false, false]);
  });

  it.each(PRINTINGS)('$cardId applies the same incomplete-payment rejection for owner opp', row => {
    const state = stateFor(row, 'opp', [false, false]);
    install(state, `${row.cardId}:wave70-owner-opp`, 'opp');
    const selfEvidence = JSON.parse(JSON.stringify(current().players.self.evidence));
    const before = current();

    expect(dispatch([0, 1])).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(current().players.self.evidence).toEqual(selfEvidence);
    expect(current().players.opp.evidence.map(entry => entry.faceUp)).toEqual([false, false]);
  });

  it.each(PRINTINGS)('$cardId is not enumerated for CPU when only two own cards can pay', row => {
    const state = stateFor(row, 'opp', [false, false]);
    const move = enumerateMoves(state, 'opp').find(candidate => (
      candidate.kind === 'declaredAbility'
      && candidate.uid === 'case:opp'
      && candidate.abilityId === 'a2'
    ));

    expect(move).toBeUndefined();
    expect(state.players.self.evidence.map(entry => entry.faceUp)).toEqual([false, false, false]);
    expect(state.players.opp.evidence.map(entry => entry.faceUp)).toEqual([false, false]);
  });
});
