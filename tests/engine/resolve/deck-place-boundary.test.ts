// A human deckPlace decision is a hard effect-stack boundary, just like deck reorder.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { createEmptyGameState } from '@/engine/state-factory';
import { resolve } from '@/engine/resolve';
import { run as runEffect } from '@/engine/effect/resolver';
import { applyDeckPlaceAndContinuation, applyDeckReorderAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingDeckPlaceSide } from '@/engine/effect/atom-handlers';
import { persistPendingRuntimeState, resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import type { Candidate, CausalLogEntryV1, Effect, EffectCtx, EffectStackEntry, GameState } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { useGameStateStore } from '@/ui/state/store';
import { cardOccurrenceUid, cardOccurrenceWitness } from '@/engine/target/card-occurrence';

const globals = globalThis as {
  __humanPlayerSide?: 'self' | 'opp' | null;
  __pendingDeckPlaceSide?: unknown;
  __pendingDeckReorderSide?: unknown;
};

function entry(
  state: GameState,
  id: string,
  effect: Effect,
  bindings?: Record<string, Candidate[]>,
): EffectStackEntry {
  return {
    id,
    source: { player: 'self', cardId: 'HOST', uid: 'host' },
    triggeredBy: { hook: 'manual' },
    triggeredAt: { turn: state.turn.number, phase: state.turn.phase, nano: 0 },
    effect,
    bindings,
    state: 'pending',
  };
}

function charCandidate(cardId: string, uid: string): Candidate {
  return { kind: 'char', cardId, uid, player: 'self', area: 'scene' } as Candidate;
}

function deckCandidate(
  state: GameState,
  player: 'self' | 'opp',
  index: number,
): Candidate {
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

function ctxLossEffect(pause: Effect): Effect {
  return {
    kind: 'sequence',
    steps: [
      {
        kind: 'parallel',
        steps: [{
          kind: 'sequence',
          steps: [
            {
              kind: 'custom',
              fn: (_state, branchCtx) => {
                branchCtx.bindings = {
                  ...branchCtx.bindings,
                  $target: [charCandidate('A', 'branch-a')],
                };
              },
            },
            pause,
          ],
        }],
      },
      {
        kind: 'custom',
        fn: (state, outerCtx) => {
          const target = outerCtx.bindings.$target?.[0] as { cardId?: string } | undefined;
          state.players.self.hand.push(target?.cardId ?? 'MISSING');
        },
      },
    ],
  };
}

function pauseDeckPlaceSequence(sessionId: string): GameState {
  const state = createEmptyGameState();
  state.players.opp.deck = ['A', 'B', 'TAIL'];
  startCausalSession(state, sessionId);
  resetPresentationQueue(sessionId);
  const window = [deckCandidate(state, 'opp', 0), deckCandidate(state, 'opp', 1)];
  const effect: Effect = {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'deckPlaceSplitBound', args: { player: 'opp', bindKey: '$window' } },
      { kind: 'atom', verb: 'draw', args: { player: 'opp', n: 1 } },
    ],
  };
  return produce(state, (draft) => {
    event.queue(draft, effect, {
      player: 'self',
      cardId: 'HOST',
      uid: 'host',
      abilityId: 'a1',
      area: 'scene',
    }, 'manual', undefined, { $window: window });
    resolve.runAllUntilEmpty(draft);
  });
}

function surfaceDeckPlace(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state, { preserveRuntime: true })).toBe(true);
  surfacePendingSideChannels();
}

function pauseDeckReorderSequence(): GameState {
  const state = createEmptyGameState();
  state.players.self.deck = ['TAIL', 'P1', 'P2'];
  const moved = [deckCandidate(state, 'self', 1), deckCandidate(state, 'self', 2)];
  runEffect(state, {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'deckBottomReorderBound', args: { player: 'self', bindKey: '$moved' } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  }, {
    source: { player: 'self', cardId: 'HOST', uid: 'host', abilityId: 'a1', area: 'scene' },
    bindings: { $moved: moved },
  });
  persistPendingRuntimeState(state);
  expect(useGameStateStore.getState().setGameState(state, { preserveRuntime: true })).toBe(true);
  surfacePendingSideChannels();
  return state;
}

beforeEach(() => {
  globals.__humanPlayerSide = 'self';
  globals.__pendingDeckPlaceSide = null;
  globals.__pendingDeckReorderSide = null;
  useGameStateStore.getState().setGameState(null);
  useGameStateStore.getState().setPendingDeckPlace(null);
  useGameStateStore.getState().setPendingDeckReorder(null);
});

afterEach(() => {
  globals.__humanPlayerSide = null;
  globals.__pendingDeckPlaceSide = null;
  globals.__pendingDeckReorderSide = null;
  useGameStateStore.getState().setGameState(null);
  useGameStateStore.getState().setPendingDeckPlace(null);
  useGameStateStore.getState().setPendingDeckReorder(null);
});

describe('deckPlace boundary: effect stack', () => {
  it('keeps the human pending decision and leaves the next stack entry unresolved', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B', 'TAIL'];
    const window = [deckCandidate(state, 'self', 0), deckCandidate(state, 'self', 1)];
    resolve.queue(state, entry(
      state,
      'place-first',
      { kind: 'atom', verb: 'deckPlaceSplitBound', args: { player: 'self', bindKey: '$window' } },
      { $window: window },
    ));
    resolve.queue(state, entry(
      state,
      'draw-second',
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ));

    resolve.runAllUntilEmpty(state);
    expect(resolve.pendingOwnerOrderGroup(state, 'self').map(item => item.id))
      .toEqual(['place-first', 'draw-second']);
    expect(state.pendingEffects.map(item => item.state)).toEqual(['pending', 'pending']);
    state.pendingEffects.forEach((item, order) => {
      item.ownerChosenOrder = order;
      item.ownerOrderConfirmed = true;
    });
    resolve.runAllUntilEmpty(state);

    expect(globals.__pendingDeckPlaceSide).toMatchObject({
      player: 'self',
      ownerPlayer: 'self',
      cardIds: ['A', 'B'],
    });
    expect(state.pendingEffects.map(item => item.state)).toEqual(['resolved', 'pending']);
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.deck).toEqual(['A', 'B', 'TAIL']);
  });

  it('resumes the same effect after a self-owned choice on the opponent deck', () => {
    surfaceDeckPlace(pauseDeckPlaceSequence('deck-place-resume'));
    const pending = useGameStateStore.getState().pendingDeckPlace!;

    expect(pending).toMatchObject({
      player: 'opp',
      ownerPlayer: 'self',
      cardIds: ['A', 'B'],
      deckSnapshot: ['A', 'B', 'TAIL'],
      occurrences: [{ cardId: 'A', index: 0 }, { cardId: 'B', index: 1 }],
    });
    expect(pending.continuation).toBeDefined();
    expect(useGameStateStore.getState().gameState!.players.opp.hand).toEqual([]);
    expect(validateCausalLog(useGameStateStore.getState().gameState!.log as CausalLogEntryV1[])
      .map((node) => node.kind)).toEqual(['declare']);

    const result = dispatchEngineAction(bindPendingDecision(pending, {
      type: 'deckPlaceResolve',
      top: ['B'],
      bottom: ['A'],
    }));

    expect(result).toEqual({ ok: true });
    const after = useGameStateStore.getState();
    expect(after.pendingDeckPlace).toBeNull();
    expect(after.gameState!.players.opp.hand).toEqual(['B']);
    expect(after.gameState!.players.opp.deck).toEqual(['TAIL', 'A']);
    const graph = validateCausalLog(after.gameState!.log as CausalLogEntryV1[]);
    expect(graph.map((node) => node.kind)).toEqual(['declare', 'select', 'draw', 'summary']);
    expect(graph[1]?.actor).toBe('self');
    expect(graph[2]?.actor).toBe('self');
    expect(graph[2]?.source).toMatchObject({ kind: 'zone', side: 'opp', zone: 'deck' });
    expect(graph[2]?.targets).toEqual([
      expect.objectContaining({ kind: 'zone', side: 'opp', zone: 'hand' }),
    ]);
    expect(after.gameState!.pendingRuntimeState).toBeUndefined();

    const restored = JSON.parse(JSON.stringify(after.gameState)) as GameState;
    resetPendingRuntimeState();
    useGameStateStore.getState().setGameState(null);
    useGameStateStore.getState().setPendingDeckPlace(null);
    expect(useGameStateStore.getState().setGameState(restored, { preserveRuntime: true })).toBe(true);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingDeckPlace).toBeNull();
  });

  it('rejects a stale target-deck snapshot atomically and keeps the decision retryable', () => {
    surfaceDeckPlace(pauseDeckPlaceSequence('deck-place-stale'));
    const pending = useGameStateStore.getState().pendingDeckPlace!;
    const stale = structuredClone(useGameStateStore.getState().gameState!);
    stale.players.opp.deck = ['TAIL', 'A', 'B'];
    useGameStateStore.setState({ gameState: stale });

    const result = dispatchEngineAction(bindPendingDecision(pending, {
      type: 'deckPlaceResolve',
      top: ['B'],
      bottom: ['A'],
    }));

    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    const after = useGameStateStore.getState();
    expect(after.gameState!.players.opp.deck).toEqual(['TAIL', 'A', 'B']);
    expect(after.gameState!.players.opp.hand).toEqual([]);
    expect(after.pendingDeckPlace?.decisionId).toBe(pending.decisionId);
    expect(validateCausalLog(after.gameState!.log as CausalLogEntryV1[])
      .map((node) => node.kind)).toEqual(['declare']);
  });

  it('restores the outer context after a nested parallel deck-place pause', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['P1', 'P2', 'TAIL'];
    const ctx: EffectCtx = {
      source: { player: 'self', cardId: 'HOST', uid: 'host', abilityId: 'a1', area: 'scene' },
      bindings: {
        $target: [charCandidate('B', 'outer-b')],
        $moved: [deckCandidate(state, 'self', 0), deckCandidate(state, 'self', 1)],
      },
      dyn: { runtimePickOwnerKnown: true, runtimeHumanPlayer: 'self' },
    };

    runEffect(state, ctxLossEffect({
      kind: 'atom',
      verb: 'deckPlaceSplitBound',
      args: { player: 'self', bindKey: '$moved' },
    }), ctx);
    const pending = _drainPendingDeckPlaceSide();

    expect(applyDeckPlaceAndContinuation(state, pending!, ['P2'], ['P1'])).toBe(true);
    expect(state.players.self.hand).toEqual(['B']);
  });

  it('does not execute a deck-place continuation forged in the UI projection', () => {
    surfaceDeckPlace(pauseDeckPlaceSequence('deck-place-authority'));
    const canonical = useGameStateStore.getState().pendingDeckPlace!;
    const forged = {
      ...canonical,
      continuation: {
        remainder: [{
          kind: 'custom' as const,
          fn: (state: GameState) => { state.players.self.hand.push('FORGED'); },
        }],
        ctx: canonical.continuation!.ctx,
        kind: 'sequence' as const,
      },
    };
    useGameStateStore.setState({ pendingDeckPlace: forged });

    expect(dispatchEngineAction(bindPendingDecision(forged, {
      type: 'deckPlaceResolve',
      top: ['B'],
      bottom: ['A'],
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.hand).toEqual([]);
    expect(useGameStateStore.getState().gameState?.players.opp.hand).toEqual(['B']);
  });

  it('does not execute a deck-reorder continuation forged in the UI projection', () => {
    pauseDeckReorderSequence();
    const canonical = useGameStateStore.getState().pendingDeckReorder!;
    const forged = {
      ...canonical,
      continuation: {
        remainder: [{
          kind: 'custom' as const,
          fn: (state: GameState) => { state.players.self.hand.push('FORGED'); },
        }],
        ctx: canonical.continuation!.ctx,
        kind: 'sequence' as const,
      },
    };
    useGameStateStore.setState({ pendingDeckReorder: forged });

    expect(dispatchEngineAction(bindPendingDecision(forged, {
      type: 'deckReorderResolve',
      order: ['P2', 'P1'],
    }))).toEqual({ ok: true });
    const after = useGameStateStore.getState();
    expect(after.gameState?.players.self.hand).toEqual(['TAIL']);
    expect(after.gameState?.pendingRuntimeState).toBeUndefined();

    const restored = JSON.parse(JSON.stringify(after.gameState)) as GameState;
    resetPendingRuntimeState();
    useGameStateStore.getState().setGameState(null);
    useGameStateStore.getState().setPendingDeckReorder(null);
    expect(useGameStateStore.getState().setGameState(restored, { preserveRuntime: true })).toBe(true);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
  });

  it('rebases a separate deck-reorder continuation context before it consumes a surviving card', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['M1', 'M2', 'SURVIVOR', 'TAIL'];
    const witness = cardOccurrenceWitness(state, 'self', 'deck');
    const pendingCtx: EffectCtx = {
      source: { player: 'self', cardId: 'HOST', uid: 'host', abilityId: 'a1', area: 'scene' },
      bindings: {
        $moved: [deckCandidate(state, 'self', 0), deckCandidate(state, 'self', 1)],
        $survivor: [deckCandidate(state, 'self', 2)],
      },
    };
    const continuationCtx = structuredClone(pendingCtx);

    applyDeckReorderAndContinuation(state, {
      player: 'self',
      cardIds: ['M1', 'M2'],
      deckSnapshot: [...state.players.self.deck],
      occurrences: [{ cardId: 'M1', index: 0 }, { cardId: 'M2', index: 1 }],
      occurrenceWitness: witness,
      ctx: pendingCtx,
      continuation: {
        kind: 'sequence',
        ctx: continuationCtx,
        remainder: [{
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: { player: 'self', cardId: '$survivor.cardId' },
        }],
      },
    }, ['M2', 'M1']);

    expect(state.players.self.hand).toEqual(['SURVIVOR']);
    expect(state.players.self.deck).toEqual(['TAIL', 'M2', 'M1']);
  });

  it('rebases a surviving deck binding after selected cards are inserted on top', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['DUP', 'DUP', 'SURVIVOR', 'TAIL'];
    const witness = cardOccurrenceWitness(state, 'self', 'deck');
    const ctx: EffectCtx = {
      source: { player: 'self', cardId: 'HOST', uid: 'host', abilityId: 'a1', area: 'scene' },
      bindings: {
        $window: [deckCandidate(state, 'self', 0), deckCandidate(state, 'self', 1)],
        $survivor: [deckCandidate(state, 'self', 2)],
      },
    };

    expect(applyDeckPlaceAndContinuation(state, {
      player: 'self',
      ownerPlayer: 'self',
      cardIds: ['DUP', 'DUP'],
      deckSnapshot: [...state.players.self.deck],
      occurrences: [{ cardId: 'DUP', index: 0 }, { cardId: 'DUP', index: 1 }],
      occurrenceWitness: witness,
      ctx,
      continuation: {
        kind: 'sequence',
        ctx,
        remainder: [{
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: { player: 'self', cardId: '$survivor.cardId' },
        }],
      },
    }, ['DUP'], ['DUP'])).toBe(true);

    expect(state.players.self.hand).toEqual(['SURVIVOR']);
    expect(state.players.self.deck).toEqual(['DUP', 'TAIL', 'DUP']);
  });

  it('consumes a resolver-owned deck-reorder authority only after a valid response', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B'];
    const pending = {
      player: 'self' as const,
      cardIds: ['A', 'B'],
      deckSnapshot: ['A', 'B'],
      occurrences: [{ cardId: 'A', index: 0 }, { cardId: 'B', index: 1 }],
      occurrenceWitness: cardOccurrenceWitness(state, 'self', 'deck'),
      ctx: {
        source: { player: 'self' as const, area: 'scene' as const, cardId: 'HOST', abilityId: 'a1' },
        bindings: {},
      },
    };
    event.queue(state, {
      kind: 'custom',
      fn: (current) => { current.players.self.hand.push('OBSERVED'); },
    }, { player: 'self', area: 'scene', cardId: 'OBSERVER', abilityId: 'a1' }, 'manual');
    globals.__pendingDeckReorderSide = pending;
    persistPendingRuntimeState(state);
    const persisted = structuredClone(state.pendingRuntimeState);

    expect(() => applyDeckReorderAndContinuation(state, pending, ['A', 'A']))
      .toThrow(/multiset/i);
    expect(state.pendingRuntimeState).toEqual(persisted);
    expect(globals.__pendingDeckReorderSide).toStrictEqual(pending);
    expect(globals.__pendingDeckReorderSide).not.toBe(pending);

    applyDeckReorderAndContinuation(state, pending, ['B', 'A']);
    expect(state.players.self.hand).toEqual(['OBSERVED']);
    expect(state.pendingRuntimeState).toBeUndefined();
    expect(globals.__pendingDeckReorderSide).toBeNull();
  });

  it('consumes a resolver-owned deck-place authority only after a valid response', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B'];
    const pending = {
      player: 'self' as const,
      ownerPlayer: 'self' as const,
      cardIds: ['A', 'B'],
      deckSnapshot: ['A', 'B'],
      occurrences: [{ cardId: 'A', index: 0 }, { cardId: 'B', index: 1 }],
      occurrenceWitness: cardOccurrenceWitness(state, 'self', 'deck'),
      ctx: {
        source: { player: 'self' as const, area: 'scene' as const, cardId: 'HOST', abilityId: 'a1' },
        bindings: {},
      },
    };
    globals.__pendingDeckPlaceSide = pending;
    persistPendingRuntimeState(state);
    const persisted = structuredClone(state.pendingRuntimeState);

    expect(applyDeckPlaceAndContinuation(state, pending, ['A', 'A'], [])).toBe(false);
    expect(state.pendingRuntimeState).toEqual(persisted);
    expect(globals.__pendingDeckPlaceSide).toStrictEqual(pending);
    expect(globals.__pendingDeckPlaceSide).not.toBe(pending);

    expect(applyDeckPlaceAndContinuation(state, pending, ['B'], ['A'])).toBe(true);
    expect(state.pendingRuntimeState).toBeUndefined();
    expect(globals.__pendingDeckPlaceSide).toBeNull();
  });
});
