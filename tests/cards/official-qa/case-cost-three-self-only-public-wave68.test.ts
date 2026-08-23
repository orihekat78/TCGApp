// qa: card:B05024:d685529c7ceef08583d418d640c7682a311cfb0fe8bc0982e0b20085b8201297
// qa: card:B05063:d685529c7ceef08583d418d640c7682a311cfb0fe8bc0982e0b20085b8201297
// qa: card:B05083:d685529c7ceef08583d418d640c7682a311cfb0fe8bc0982e0b20085b8201297
// qa: card:B06036:d685529c7ceef08583d418d640c7682a311cfb0fe8bc0982e0b20085b8201297
// qa: card:B06105:d685529c7ceef08583d418d640c7682a311cfb0fe8bc0982e0b20085b8201297
// qa: card:B10083:d685529c7ceef08583d418d640c7682a311cfb0fe8bc0982e0b20085b8201297
// qa: card:D09027:d685529c7ceef08583d418d640c7682a311cfb0fe8bc0982e0b20085b8201297
// Rules: 21-declared-ability-cost. A colon-left cost uses only its owner's cards.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyMove } from '@/ai/policy';
import { enumerateMoves } from '@/ai/move-enumerator';
import { registerAll } from '@/cards';
import { B06035 } from '@/cards/ct-p06/B06035';
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
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type BaseId = 'B05024' | 'B05063' | 'B05083' | 'B06036' | 'B06105' | 'B10083' | 'D09027';
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
  { cardId: 'B10083', baseId: 'B10083' },
  { cardId: 'B10083P', baseId: 'B10083' },
  { cardId: 'D09027', baseId: 'D09027' },
];

const BASE_ROWS = PRINTINGS.filter(row => row.cardId === row.baseId);
const SELF_A = 'W68-SELF-A';
const SELF_B = 'W68-SELF-B';
const SELF_C = 'W68-SELF-C';
const SELF_D = 'W68-SELF-D';
const SELF_E = 'W68-SELF-E';
const OPP_A = 'W68-OPP-A';
const OPP_B = 'W68-OPP-B';
const OPP_C = 'W68-OPP-C';
const SUZUKI = 'W68-SUZUKI';
const AKAI = 'W68-AKAI';
const LOW = 'W68-LOW';
const DRAW = 'W68-DRAW';
const OPP_DRAW = 'W68-OPP-DRAW';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const fixtures: CardDef[] = [
  fixture(SELF_A), fixture(SELF_B), fixture(SELF_C), fixture(SELF_D), fixture(SELF_E),
  fixture(OPP_A), fixture(OPP_B), fixture(OPP_C),
  fixture(SUZUKI, { traits: ['鈴木財閥'] }),
  fixture(AKAI, { traits: ['赤井家'] }),
  fixture(LOW, { level: 6 }),
  fixture(DRAW), fixture(OPP_DRAW),
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function evidence(cardId: string, faceUp = false, turn = 1) {
  return { cardId, faceUp, origin: { turn, via: 'effect' as const } };
}

function setupCondition(row: Row, state: GameState, owner: Player): void {
  const player = state.players[owner];
  if (row.baseId === 'B05063') {
    player.scene = [0, 1, 2].map(index => sceneChar(SUZUKI, owner + '-suzuki-' + index));
  } else if (row.baseId === 'B05083') {
    player.scene = [0, 1, 2].map(index => sceneChar(AKAI, owner + '-akai-' + index));
    player.file = [];
  } else if (row.baseId === 'B10083') {
    player.file = [0, 1, 2, 3, 4].map(index => ({
      type: 'card-back' as const,
      cardId: 'W68-FILE-' + index,
    }));
  } else {
    player.scene = [];
  }
}

function baseState(row: Row, owner: Player = 'self'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case,
    cardId: row.cardId,
    status: '解決編',
    declaredUseCount: {},
  };
  state.players[owner].evidence = [
    evidence(owner === 'self' ? SELF_A : OPP_A, false, 1),
    evidence(owner === 'self' ? SELF_B : OPP_B, true, 2),
    evidence(owner === 'self' ? SELF_C : OPP_C, false, 3),
    evidence(owner === 'self' ? SELF_D : SELF_E, false, 4),
  ];
  state.players[other(owner)].evidence = owner === 'self'
    ? [evidence(OPP_A), evidence(OPP_B), evidence(OPP_C)]
    : [evidence(SELF_A), evidence(SELF_C), evidence(SELF_D)];
  setupCondition(row, state, owner);
  return state;
}

function install(state: GameState, label: string, human: Player = 'self'): void {
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
  if (!state) throw new Error('missing Wave68 state');
  return state;
}

function dispatch(row: Row, owner: Player, indices: number[]) {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: 'case:' + owner,
    abilId: 'a2',
    abilityOrigin: 'printed',
    abilityIndex: 1,
    costParams: { flipFaceUpEvidence: { indices } },
  });
}

function decisionKinds(): string[] {
  const store = useGameStateStore.getState();
  return [
    ['pick', store.pendingEffectPick],
    ['choice', store.pendingEffectChoice],
    ['optional', store.pendingEffectOptional],
    ['hirameki', store.pendingHirameki],
  ].filter(entry => Boolean(entry[1])).map(entry => entry[0] as string);
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave68: exact-three case costs use only owner evidence', () => {
  // Card-bound physical rows: B05024/P B05063/P B05083/P B06036/P B06105/P B10083/P D09027.
  it.each(PRINTINGS)('$cardId flips exact nonadjacent owner evidence and preserves the other side', row => {
    const state = baseState(row);
    const ownerIdentity = state.players.self.evidence.map(({ cardId, origin }) => ({ cardId, origin }));
    const opponent = JSON.parse(JSON.stringify(state.players.opp.evidence));
    install(state, row.cardId + ':wave68-positive');

    expect(dispatch(row, 'self', [3, 0, 2])).toEqual({ ok: true });
    expect(current().players.self.case.cardId).toBe(row.cardId);
    expect(current().players.self.evidence.map(({ cardId, origin }) => ({ cardId, origin })))
      .toEqual(ownerIdentity);
    expect(current().players.self.evidence.map(entry => entry.faceUp))
      .toEqual([true, true, true, true]);
    expect(current().players.opp.evidence).toEqual(opponent);
    expect(readChar.declaredUseCount(current(), 'case:self', 'a2', {
      abilityOrigin: 'printed',
      abilityIndex: 1,
    })).toBe(1);
  });

  it.each(BASE_ROWS)('$cardId cannot substitute three opponent cards for a short owner payment', row => {
    const state = baseState(row);
    state.players.self.evidence = [evidence(SELF_A), evidence(SELF_C)];
    state.players.opp.evidence = [evidence(OPP_A), evidence(OPP_B), evidence(OPP_C)];
    install(state, row.cardId + ':wave68-opponent-substitution');
    const before = current();
    const beforeJson = JSON.stringify(before);

    expect(dispatch(row, 'self', [0, 1, 2])).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
    expect(current().players.opp.evidence.map(entry => entry.faceUp)).toEqual([false, false, false]);
    expect(decisionKinds()).toEqual([]);
    expect(readChar.declaredUseCount(current(), 'case:self', 'a2', {
      abilityOrigin: 'printed',
      abilityIndex: 1,
    })).toBe(0);
  });

  it.each(BASE_ROWS)('$cardId rejects malformed owner selections atomically', row => {
    const attempts = [
      { label: 'two', indices: [0, 2] },
      { label: 'duplicate', indices: [0, 2, 2] },
      { label: 'face-up', indices: [0, 1, 2] },
      { label: 'out-of-range', indices: [0, 2, 9] },
    ];
    for (const attempt of attempts) {
      install(baseState(row), row.cardId + ':wave68-' + attempt.label);
      const before = current();
      const beforeJson = JSON.stringify(before);
      expect(dispatch(row, 'self', attempt.indices)).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(before);
      expect(JSON.stringify(current())).toBe(beforeJson);
      expect(decisionKinds()).toEqual([]);
    }

    const four = baseState(row);
    four.players.self.evidence = [SELF_A, SELF_B, SELF_C, SELF_D, SELF_E]
      .map((cardId, index) => evidence(cardId, false, index + 1));
    install(four, row.cardId + ':wave68-four');
    const before = current();
    expect(dispatch(row, 'self', [0, 1, 2, 3])).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
  });

  it.each(BASE_ROWS)('$cardId resolves owner-relative for an opponent physical case source', row => {
    const state = baseState(row, 'opp');
    const selfEvidence = JSON.parse(JSON.stringify(state.players.self.evidence));
    install(state, row.cardId + ':wave68-owner-opp', 'opp');

    expect(dispatch(row, 'opp', [3, 0, 2])).toEqual({ ok: true });
    expect(current().players.opp.case.cardId).toBe(row.cardId);
    expect(current().players.opp.evidence.map(entry => entry.faceUp)).toEqual([true, true, true, true]);
    expect(current().players.self.evidence).toEqual(selfEvidence);
  });

  it('B06036 preserves the cost-flipped Hirameki candidate through save hydration', () => {
    const row = { cardId: 'B06036', baseId: 'B06036' } as const;
    const state = baseState(row);
    state.players.self.evidence = [
      evidence(B06035.id),
      evidence(SELF_A),
      evidence(SELF_C),
      evidence(SELF_D, true),
    ];
    install(state, 'B06036:wave68-save');

    expect(dispatch(row, 'self', [0, 1, 2])).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick?.candidates.map(entry => entry.cardId))
      .toEqual([B06035.id]);
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    surfacePendingSideChannels();
    const restored = useGameStateStore.getState().pendingEffectPick;
    expect(restored?.source).toMatchObject({ cardId: row.cardId, abilityId: 'a2' });
    expect(restored?.candidates.map(entry => entry.cardId)).toEqual([B06035.id]);
    expect(dispatchEngineAction(bindPendingDecision(restored!, {
      type: 'effectPickResolve',
      pickedUid: restored!.candidates[0]!.uid,
    }))).toEqual({ ok: true });
    surfacePendingSideChannels();
    const invoked = useGameStateStore.getState().pendingEffectOptional;
    expect(invoked?.source).toMatchObject({ cardId: B06035.id, abilityId: 'a2' });
    expect(dispatchEngineAction(bindPendingDecision(invoked!, {
      type: 'optionalResolve',
      run: false,
    }))).toEqual({ ok: true });
  });

  it('D09027 CPU payment flips the first three own facedown occurrences only', () => {
    const row = { cardId: 'D09027', baseId: 'D09027' } as const;
    const state = baseState(row, 'opp');
    const move = enumerateMoves(state, 'opp').find(candidate => (
      candidate.kind === 'declaredAbility'
      && candidate.uid === 'case:opp'
      && candidate.abilityId === 'a2'
    ));
    expect(move).toBeTruthy();
    const after = produce(state, draft => {
      applyMove(draft, move!, 'opp');
      runAllUntilEmpty(draft);
    });
    expect(after.players.opp.evidence.map(entry => entry.faceUp)).toEqual([true, true, true, true]);
    expect(after.players.self.evidence.map(entry => entry.faceUp)).toEqual([false, false, false]);
  });

  it('B06105 forced draw refreshes only after the owner cost and opponent discard', () => {
    const row = { cardId: 'B06105', baseId: 'B06105' } as const;
    const state = baseState(row);
    state.players.self.deck = [];
    state.players.self.remove = [DRAW];
    state.players.opp.hand = [LOW];
    state.players.opp.deck = [OPP_DRAW];
    install(state, 'B06105:wave68-refresh');

    expect(dispatch(row, 'self', [3, 0, 2])).toEqual({ ok: true });
    expect(current().players.opp.remove).toContain(LOW);
    expect(current().players.self.hand).toContain(DRAW);
    expect(current().refreshCount.self).toBe(1);
    expect(current().players.opp.evidence).toContainEqual(
      expect.objectContaining({ cardId: 'penalty-card', faceUp: false }),
    );
  });
});
