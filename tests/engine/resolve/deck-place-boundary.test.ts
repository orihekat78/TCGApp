// A human deckPlace decision is a hard effect-stack boundary, just like deck reorder.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { createEmptyGameState } from '@/engine/state-factory';
import { resolve } from '@/engine/resolve';
import { run as runEffect } from '@/engine/effect/resolver';
import { applyDeckPlaceAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingDeckPlaceSide } from '@/engine/effect/atom-handlers';
import { persistPendingRuntimeState } from '@/engine/effect/runtime-state';
import type { Candidate, CausalLogEntryV1, Effect, EffectCtx, EffectStackEntry, GameState } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { useGameStateStore } from '@/ui/state/store';

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
  const window = ['A', 'B'].map((cardId, index) => ({
    kind: 'card' as const,
    cardId,
    area: 'deck' as const,
    player: 'opp' as const,
    index,
  }));
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
  const moved = ['P1', 'P2'].map((cardId, index) => ({
    kind: 'card' as const,
    cardId,
    area: 'deck' as const,
    player: 'self' as const,
    index: index + 1,
  }));
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
    const window = ['A', 'B'].map((cardId, index) => ({
      kind: 'card' as const,
      cardId,
      area: 'deck' as const,
      player: 'self' as const,
      index,
    }));
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
        $moved: ['P1', 'P2'].map((cardId, index) => ({
          kind: 'card', cardId, area: 'deck', player: 'self', index,
        } as Candidate)),
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
    expect(useGameStateStore.getState().gameState?.players.self.hand).toEqual(['TAIL']);
  });
});
