// qa: card:B06013:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:B06043:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:B06065:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:B06095:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:B09111:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:B09112:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// Rules: 21-declared-ability-cost. Exact own face-down positions may be chosen without reordering.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09112 } from '@/cards/ct-p09/B09112';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  FILE_CARD_BACK_PLACEHOLDER,
  type CardDef,
  type GameState,
} from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { useEvidenceFlipPicker } from '@/ui/hooks/useEvidenceFlipPicker';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type BaseId = 'B06013' | 'B06043' | 'B06065' | 'B06095' | 'B09111' | 'B09112';
type Row = { cardId: string; baseId: BaseId };

const PRINTINGS: Row[] = [
  { cardId: 'B06013', baseId: 'B06013' },
  { cardId: 'B06013P', baseId: 'B06013' },
  { cardId: 'B06043', baseId: 'B06043' },
  { cardId: 'B06043P', baseId: 'B06043' },
  { cardId: 'B06065', baseId: 'B06065' },
  { cardId: 'B06065P', baseId: 'B06065' },
  { cardId: 'B06095', baseId: 'B06095' },
  { cardId: 'B06095P', baseId: 'B06095' },
  { cardId: 'B09111', baseId: 'B09111' },
  { cardId: 'B09111P', baseId: 'B09111' },
  { cardId: 'B09112', baseId: 'B09112' },
  { cardId: 'B09112P', baseId: 'B09112' },
];

const BASE_ROWS = PRINTINGS.filter(row => row.cardId === row.baseId);
const KUDO = 'W67_KUDO';
const HATTORI = 'W67_HATTORI';
const NAMED_A = 'W67_NAMED_A';
const NAMED_B = 'W67_NAMED_B';
const MATCH = 'W67_MATCH';
const DECOY = 'W67_DECOY';
const TAIL = 'W67_TAIL';
const FILE_CARD = 'W67_FILE_CARD';
const DRAW = 'W67_DRAW';
const SELF_A = 'W67_SELF_A';
const SELF_B = 'W67_SELF_B';
const SELF_C = 'W67_SELF_C';
const SELF_D = 'W67_SELF_D';
const OPP_A = 'W67_OPP_A';
const OPP_B = 'W67_OPP_B';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: 'test/' + id, kind: 'character', names: [id], colors: ['青'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const fixtures: CardDef[] = [
  character(KUDO, { names: ['工藤新一'] }),
  character(HATTORI, { names: ['服部平次'] }),
  character(NAMED_A, { names: ['江戸川コナン'] }),
  character(NAMED_B, { names: ['江戸川コナン'] }),
  character(MATCH, { names: ['江戸川コナン'] }),
  character(DECOY, { names: ['毛利蘭'] }),
  character(TAIL),
  character(FILE_CARD, { names: ['別名'] }),
  character(DRAW),
  character(SELF_A),
  character(SELF_B),
  character(SELF_C),
  character(SELF_D),
  character(OPP_A),
  character(OPP_B),
];

function baseState(row: Row): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = {
    ...state.players.self.case,
    cardId: row.cardId,
    status: '解決編',
    declaredUseCount: {},
  };
  state.players.self.evidence = [
    { cardId: SELF_A, faceUp: false, origin: { turn: 1, via: 'opening' } },
    { cardId: SELF_B, faceUp: true, origin: { turn: 2, via: 'reasoning' } },
    { cardId: SELF_C, faceUp: false, origin: { turn: 3, via: 'effect' } },
    { cardId: SELF_D, faceUp: false, origin: { turn: 4, via: 'reasoning' } },
  ];
  state.players.opp.evidence = [
    { cardId: OPP_A, faceUp: false, origin: { turn: 1, via: 'opening' } },
    { cardId: OPP_B, faceUp: true, origin: { turn: 2, via: 'effect' } },
  ];
  if (row.baseId === 'B06013') {
    state.players.self.scene = [sceneChar(KUDO, 'wave67-kudo')];
  } else if (row.baseId === 'B06043') {
    state.players.self.scene = [sceneChar(HATTORI, 'wave67-hattori')];
  } else {
    state.players.self.scene = [];
  }
  if (row.baseId === 'B09111') {
    state.players.opp.file = [{ type: 'card-back', cardId: FILE_CARD }];
    state.players.opp.deck = [DRAW, TAIL];
  }
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
  if (!state) throw new Error('missing Wave67 state');
  return state;
}

function costParams(row: Row, indices: number[]) {
  return {
    flipFaceUpEvidence: { indices },
    ...(['B09111', 'B09112'].includes(row.baseId)
      ? { declaredName: '江戸川コナン' }
      : {}),
  };
}

function dispatch(row: Row, indices: number[]) {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: 'case:self',
    abilId: 'a2',
    abilityOrigin: 'printed',
    abilityIndex: 1,
    costParams: costParams(row, indices),
  });
}

function decisionKinds(): string[] {
  const store = useGameStateStore.getState();
  return [
    ['choice', store.pendingEffectChoice],
    ['optional', store.pendingEffectOptional],
    ['pick', store.pendingEffectPick],
    ['deck-place', store.pendingDeckPlace],
    ['deck-reorder', store.pendingDeckReorder],
  ].filter(entry => Boolean(entry[1])).map(entry => entry[0] as string);
}

function presentationState(cardId: string): GameState {
  const state = baseState({ cardId, baseId: 'B09112' });
  state.players.self.scene = [
    sceneChar(NAMED_A, 'wave67-named-a'),
    sceneChar(NAMED_B, 'wave67-named-b'),
  ];
  state.players.self.deck = [DECOY, MATCH, TAIL];
  return state;
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
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave67: exact-two evidence may use arbitrary positions without reordering', () => {
  // Card-bound physical rows: B06013/P B06043/P B06065/P B06095/P B09111/P B09112/P.
  it.each(PRINTINGS)('$cardId accepts non-sorted nonadjacent positions [3,0]', row => {
    const state = baseState(row);
    const identity = state.players.self.evidence.map(({ cardId, origin }) => ({ cardId, origin }));
    const opponent = JSON.parse(JSON.stringify(state.players.opp.evidence));
    install(state, row.cardId + ':wave67-position-positive');

    expect(dispatch(row, [3, 0]), row.cardId + ': arbitrary positions accepted').toEqual({ ok: true });
    expect(current().players.self.case.cardId).toBe(row.cardId);
    expect(current().players.self.evidence.map(({ cardId, origin }) => ({ cardId, origin })))
      .toEqual(identity);
    expect(current().players.self.evidence.map(entry => entry.faceUp))
      .toEqual([true, true, false, true]);
    expect(current().players.opp.evidence).toEqual(opponent);
    expect(readChar.declaredUseCount(current(), 'case:self', 'a2', {
      abilityOrigin: 'printed',
      abilityIndex: 1,
    })).toBe(1);
  });

  it.each(BASE_ROWS)('$cardId rejects malformed selections transactionally', row => {
    const invalid = [
      { label: 'one', indices: [0] },
      { label: 'three', indices: [0, 2, 3] },
      { label: 'duplicate', indices: [0, 0] },
      { label: 'out-of-range', indices: [0, 9] },
      { label: 'already-face-up', indices: [0, 1] },
    ];
    for (const attempt of invalid) {
      install(baseState(row), row.cardId + ':wave67-' + attempt.label);
      const before = current();
      const beforeJson = JSON.stringify(before);
      expect(dispatch(row, attempt.indices)).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(before);
      expect(JSON.stringify(current())).toBe(beforeJson);
      expect(decisionKinds()).toEqual([]);
      expect(current().pendingRuntimeState).toBeUndefined();
      expect(readChar.declaredUseCount(current(), 'case:self', 'a2', {
        abilityOrigin: 'printed',
        abilityIndex: 1,
      })).toBe(0);
    }
  });

  it.each(BASE_ROWS)('$cardId preserves paid evidence identity and order across save hydration', row => {
    install(baseState(row), row.cardId + ':wave67-save');
    expect(dispatch(row, [3, 0])).toEqual({ ok: true });
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    expect(current().players.self.evidence.map(entry => [entry.cardId, entry.faceUp, entry.origin]))
      .toEqual([
        [SELF_A, true, { turn: 1, via: 'opening' }],
        [SELF_B, true, { turn: 2, via: 'reasoning' }],
        [SELF_C, false, { turn: 3, via: 'effect' }],
        [SELF_D, true, { turn: 4, via: 'reasoning' }],
      ]);
  });

  it('human picker and spectator projection retain arbitrary-position privacy', async () => {
    const state = baseState({ cardId: 'B06095', baseId: 'B06095' });
    const before = projectReplayStateForViewer(state, 'spectator');
    expect(before.players.self.evidence.map(entry => entry.cardId)).toEqual([
      FILE_CARD_BACK_PLACEHOLDER,
      SELF_B,
      FILE_CARD_BACK_PLACEHOLDER,
      FILE_CARD_BACK_PLACEHOLDER,
    ]);
    const answer = useEvidenceFlipPicker().ask({
      side: 'self',
      sourceName: 'B06095',
      candidates: [
        { index: 0, cardId: SELF_A },
        { index: 2, cardId: SELF_C },
        { index: 3, cardId: SELF_D },
      ],
      nMin: 2,
      nMax: 2,
    });
    useEvidenceFlipPicker().confirm([3, 0]);
    await expect(answer).resolves.toEqual({ kind: 'confirm', indices: [3, 0] });

    install(state, 'B06095:wave67-projection');
    expect(dispatch({ cardId: 'B06095', baseId: 'B06095' }, [3, 0])).toEqual({ ok: true });
    const after = projectReplayStateForViewer(current(), 'spectator');
    expect(after.players.self.evidence.map(entry => entry.cardId)).toEqual([
      SELF_A,
      SELF_B,
      FILE_CARD_BACK_PLACEHOLDER,
      SELF_D,
    ]);
  });

  it.each(['B09112', 'B09112P'])('%s publishes the selected named card and no private remainder', cardId => {
    install(presentationState(cardId), cardId + ':wave67-public-selection');
    expect(dispatch({ cardId, baseId: 'B09112' }, [3, 0])).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick?.atomVerb).toBe('deckRevealUntil');
    expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([MATCH]);
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: 'self',
      visibility: 'private',
      viewer: 'self',
      revealed: [DECOY, MATCH],
      awaitingPick: true,
    });
    const match = pick!.candidates.find(candidate => candidate.cardId === MATCH)!;
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve',
      pickedUid: match.uid,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner: 'self',
      audience: 'all',
      cardIds: [MATCH],
      lifetime: 'presentation',
      origin: 'deck-selected-card',
      source: { cardId, abilityId: 'a2' },
    });
    expect(current().players.self.hand).toContain(MATCH);
  });
});
