import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAll } from '@/cards';
import { persistPendingRuntimeState, resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { run as runEffect } from '@/engine/effect/resolver';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { createEmptyGameState } from '@/engine/state-factory';
import { cardOccurrenceUid, cardOccurrenceWitness } from '@/engine/target/card-occurrence';
import type { Candidate, Effect, EffectCtx, GameState, Player } from '@/engine/types';
import { useEffectPickFlowDriver } from '@/ui/hooks/useEffectPickFlowDriver';
import { selectAutonomousDecisionBlocked } from '@/ui/state/autonomousDecisionGate';
import { useGameStateStore } from '@/ui/state/store';

function ctx(cardId: string, bindings: EffectCtx['bindings'] = {}): EffectCtx {
  return {
    source: {
      player: 'opp',
      area: 'scene',
      cardId,
      uid: `${cardId}#1`,
      abilityId: 'wave23',
    },
    bindings,
  };
}

function deckCandidate(state: GameState, player: Player, index: number): Candidate {
  const cardId = state.players[player].deck[index]!;
  return {
    kind: 'card',
    cardId,
    uid: cardOccurrenceUid(player, 'deck', cardId, index),
    player,
    area: 'deck',
    index,
    occurrenceWitness: cardOccurrenceWitness(state, player, 'deck'),
  };
}

function jsonRoundTrip(state: GameState, expectedKeys: string[]): GameState {
  persistPendingRuntimeState(state);
  expect(state.pendingRuntimeState).toBeDefined();
  expect(state.pendingRuntimeState?.snapshot).toEqual(expect.arrayContaining(
    expectedKeys.map(key => expect.objectContaining({ key, present: true, value: expect.anything() })),
  ));
  const restored = JSON.parse(JSON.stringify(state)) as GameState;
  resetPendingRuntimeState();
  return restored;
}

function Harness(): null {
  useEffectPickFlowDriver();
  return null;
}

function mountRestored(state: GameState): Root {
  _setHumanPlayerSide('self');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  expect(selectAutonomousDecisionBlocked(useGameStateStore.getState())).toBe(true);
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Harness)));
  return root;
}

function expectRuntimeUnblocked(): void {
  const store = useGameStateStore.getState();
  expect(store.gameState?.pendingRuntimeState).toBeUndefined();
  expect(selectAutonomousDecisionBlocked(store)).toBe(false);
}

describe('Wave 23: restored dedicated side-channel decisions', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    registerAll();
    useGameStateStore.getState().resetMatchSessionState();
    resetPendingRuntimeState();
    _setHumanPlayerSide(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useGameStateStore.getState().resetMatchSessionState();
    resetPendingRuntimeState();
    _setHumanPlayerSide(null);
  });

  it('restores opponent RPS, applies the non-tie fallback, then runs the tail', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    _setHumanPlayerSide('opp');
    const state = createEmptyGameState();
    state.players.opp.deck = ['WIN', 'TAIL', 'RESERVE'];
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'rps',
          win: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          lose: { kind: 'parallel', steps: [] },
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    };
    runEffect(state, effect, ctx('WAVE23-RPS'));
    const restored = jsonRoundTrip(state, [
      '__pendingRpsSide',
      '__pendingRpsResume',
      '__pendingRpsContinuation',
    ]);

    const root = mountRestored(restored);
    try {
      expect(useGameStateStore.getState().pendingRps).toBeNull();
      expect(useGameStateStore.getState().gameState?.players.opp.hand).toEqual(['WIN', 'TAIL']);
      expectRuntimeUnblocked();
    } finally {
      act(() => root.unmount());
    }
  });

  it('restores opponent set-card choice, selects the last occurrence, then runs the tail', () => {
    _setHumanPlayerSide('opp');
    const state = createEmptyGameState();
    state.players.opp.deck = ['TAIL'];
    const host = mutate.scene.enter(state, 'opp', 'D03003', {});
    mutate.char.setCard(state, host.uid, 'FIRST', false);
    mutate.char.setCard(state, host.uid, 'SECOND', false);
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        { kind: 'setCardToEvidence', hostUid: host.uid },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    };
    runEffect(state, effect, ctx('WAVE23-SET-CHOICE'));
    const restored = jsonRoundTrip(state, [
      '__pendingSetCardChoiceSide',
      '__pendingSetCardChoiceResume',
      '__pendingSetCardChoiceContinuation',
    ]);

    const root = mountRestored(restored);
    try {
      const store = useGameStateStore.getState();
      expect(store.pendingSetCardChoice).toBeNull();
      expect(store.gameState?.players.opp.evidence.map(card => card.cardId)).toEqual(['SECOND']);
      expect(store.gameState?.players.opp.scene[0]?.setCards.map(card => card.cardId)).toEqual(['FIRST']);
      expect(store.gameState?.players.opp.hand).toEqual(['TAIL']);
      expectRuntimeUnblocked();
    } finally {
      act(() => root.unmount());
    }
  });

  it('restores opponent set-card replacement and resumes the suspended removal', () => {
    _setHumanPlayerSide('opp');
    const state = createEmptyGameState();
    state.turn.player = 'self';
    const source = mutate.scene.enter(state, 'opp', 'D03003', {});
    const target = mutate.scene.enter(state, 'opp', 'D03003', {});
    mutate.char.setCard(state, source.uid, 'B02052', true);
    expect(mutate.scene.removeToRemove(state, source.uid, 'effect').deferred).toBe(true);
    const restored = jsonRoundTrip(state, [
      '__pendingSetCardReplacementSide',
      '__pendingSetCardReplacementGuard',
    ]);

    const root = mountRestored(restored);
    try {
      const store = useGameStateStore.getState();
      expect(store.pendingSetCardReplacement).toBeNull();
      expect(store.gameState?.players.opp.scene.some(card => card.uid === source.uid)).toBe(false);
      expect(store.gameState?.players.opp.scene.find(card => card.uid === target.uid)?.setCards)
        .toEqual([expect.objectContaining({ cardId: 'B02052', faceUp: true })]);
      expect(store.gameState?.players.opp.remove).toEqual(['D03003']);
      expectRuntimeUnblocked();
    } finally {
      act(() => root.unmount());
    }
  });

  it('restores opponent deck reorder, preserves its order, then runs the tail', () => {
    _setHumanPlayerSide('opp');
    const state = createEmptyGameState();
    state.players.opp.deck = ['TAIL', 'P1', 'P2'];
    const effectCtx = ctx('WAVE23-REORDER', {
      $moved: [deckCandidate(state, 'opp', 1), deckCandidate(state, 'opp', 2)],
    });
    runEffect(state, {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'deckBottomReorderBound', args: { player: 'self', bindKey: '$moved' } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    }, effectCtx);
    const restored = jsonRoundTrip(state, ['__pendingDeckReorderSide']);

    const root = mountRestored(restored);
    try {
      const store = useGameStateStore.getState();
      expect(store.pendingDeckReorder).toBeNull();
      expect(store.gameState?.players.opp.hand).toEqual(['TAIL']);
      expect(store.gameState?.players.opp.deck).toEqual(['P1', 'P2']);
      expectRuntimeUnblocked();
    } finally {
      act(() => root.unmount());
    }
  });

  it('uses ownerPlayer when restored placement targets the human deck, then runs the tail', () => {
    _setHumanPlayerSide('opp');
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B', 'TAIL'];
    const effectCtx = ctx('WAVE23-PLACE', {
      $window: [deckCandidate(state, 'self', 0), deckCandidate(state, 'self', 1)],
    });
    runEffect(state, {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'deckPlaceSplitBound', args: { player: 'opp', bindKey: '$window' } },
        { kind: 'atom', verb: 'draw', args: { player: 'opp', n: 1 } },
      ],
    }, effectCtx);
    const restored = jsonRoundTrip(state, ['__pendingDeckPlaceSide']);

    _setHumanPlayerSide('self');
    expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
    expect(useGameStateStore.getState().pendingDeckPlace).toMatchObject({
      player: 'self',
      ownerPlayer: 'opp',
    });
    expect(selectAutonomousDecisionBlocked(useGameStateStore.getState())).toBe(true);
    const root = createRoot(document.createElement('div'));
    act(() => root.render(createElement(Harness)));
    try {
      const store = useGameStateStore.getState();
      expect(store.pendingDeckPlace).toBeNull();
      expect(store.gameState?.players.self.hand).toEqual(['A']);
      expect(store.gameState?.players.self.deck).toEqual(['B', 'TAIL']);
      expectRuntimeUnblocked();
    } finally {
      act(() => root.unmount());
    }
  });
});
