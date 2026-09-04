import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import {
  persistPendingRuntimeState,
  resetPendingRuntimeState,
} from '@/engine/effect/runtime-state';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { Effect, EffectCtx, GameState } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';

function sourceCtx(): EffectCtx {
  return {
    source: {
      player: 'self',
      cardId: 'SOURCE',
      uid: 'source#1',
      abilityId: 'a1',
      area: 'scene',
    },
    bindings: {},
  };
}

function surface(effect: Effect, deck: string[]): GameState {
  const state = createEmptyGameState();
  state.players.self.deck = deck;
  runEffect(state, effect, sourceCtx());
  persistPendingRuntimeState(state);
  expect(useGameStateStore.getState().setGameState(state, { preserveRuntime: true })).toBe(true);
  surfacePendingSideChannels();
  return state;
}

function handThatBeats(hand: 'rock' | 'paper' | 'scissors') {
  return hand === 'rock' ? 'paper' : hand === 'paper' ? 'scissors' : 'rock';
}

describe('choice and RPS public decision authority', () => {
  beforeEach(() => {
    resetPendingRuntimeState();
    useGameStateStore.getState().resetMatchSessionState();
    useGameStateStore.setState({ pendingDecisionSeq: 0 });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });

  afterEach(() => {
    resetPendingRuntimeState();
    useGameStateStore.getState().resetMatchSessionState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('rejects a choice index added only to the mutable UI projection', () => {
    surface({
      kind: 'choice',
      options: [
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
      ],
    }, ['A', 'B']);
    const canonical = useGameStateStore.getState().pendingEffectChoice!;
    const forged = {
      ...canonical,
      options: [...canonical.options, { index: 99, label: 'forged' }],
    };
    useGameStateStore.setState({ pendingEffectChoice: forged });
    const before = useGameStateStore.getState().gameState;

    expect(dispatchEngineAction(bindPendingDecision(forged, {
      type: 'choiceResolve',
      choiceIndex: 99,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(before);
    expect(useGameStateStore.getState().pendingEffectChoice).toBe(forged);

    useGameStateStore.setState({ pendingEffectChoice: canonical });
    expect(dispatchEngineAction(bindPendingDecision(canonical, {
      type: 'choiceResolve',
      choiceIndex: 0,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.hand).toEqual(['A']);
  });

  it('executes a selected choice before surfacing the next choice after JSON hydration', () => {
    const state = createEmptyGameState();
    state.players.self.deck = Array.from({ length: 20 }, (_, index) => `CARD-${index}`);
    const ctx = sourceCtx();
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'choice',
          options: [
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
          ],
        },
        {
          kind: 'choice',
          options: [
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 4 } },
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 5 } },
          ],
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 6 } },
      ],
    };
    const walked = resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self',
      humanChooser: true,
      humanPlayer: 'self',
      source: { cardId: 'SOURCE', abilityId: 'a1' },
    });
    runEffect(state, walked, ctx);
    runAllUntilEmpty(state);
    persistPendingRuntimeState(state);

    resetPendingRuntimeState();
    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
    const first = useGameStateStore.getState().pendingEffectChoice!;
    expect(first.options).toHaveLength(2);

    expect(dispatchEngineAction(bindPendingDecision(first, {
      type: 'choiceResolve',
      choiceIndex: 1,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.hand).toHaveLength(2);
    const second = useGameStateStore.getState().pendingEffectChoice!;
    expect(second.options).toHaveLength(2);

    expect(dispatchEngineAction(bindPendingDecision(second, {
      type: 'choiceResolve',
      choiceIndex: 0,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.hand).toHaveLength(12);
  });

  it('preserves inner and outer choice continuations across consecutive JSON hydrations', () => {
    const state = createEmptyGameState();
    state.players.self.deck = Array.from({ length: 10 }, (_, index) => `CARD-${index}`);
    const ctx = sourceCtx();
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'choice',
          options: [
            {
              kind: 'sequence',
              steps: [
                {
                  kind: 'choice',
                  options: [
                    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
                    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 0 } },
                  ],
                },
                { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
              ],
            },
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 0 } },
          ],
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 4 } },
      ],
    };
    const walked = resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self',
      humanChooser: true,
      humanPlayer: 'self',
      source: { cardId: 'SOURCE', abilityId: 'a1' },
    });
    runEffect(state, walked, ctx);
    runAllUntilEmpty(state);
    persistPendingRuntimeState(state);

    resetPendingRuntimeState();
    expect(useGameStateStore.getState().setGameState(
      JSON.parse(JSON.stringify(state)) as GameState,
    )).toBe(true);
    const outer = useGameStateStore.getState().pendingEffectChoice!;
    expect(dispatchEngineAction(bindPendingDecision(outer, {
      type: 'choiceResolve',
      choiceIndex: 0,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.hand).toHaveLength(0);

    const secondPause = JSON.parse(JSON.stringify(
      useGameStateStore.getState().gameState,
    )) as GameState;
    resetPendingRuntimeState();
    expect(useGameStateStore.getState().setGameState(secondPause)).toBe(true);
    const inner = useGameStateStore.getState().pendingEffectChoice!;
    expect(dispatchEngineAction(bindPendingDecision(inner, {
      type: 'choiceResolve',
      choiceIndex: 0,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.hand).toHaveLength(7);
  });

  it('uses the resolver-owned RPS opponent hand instead of mutable UI metadata', () => {
    surface({
      kind: 'rps',
      win: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      lose: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    }, ['A', 'B']);
    const canonical = useGameStateStore.getState().pendingRps!;
    const playerHand = handThatBeats(canonical.aiHand);
    const forged = {
      ...canonical,
      aiHand: handThatBeats(playerHand),
    };
    useGameStateStore.setState({ pendingRps: forged });

    expect(dispatchEngineAction(bindPendingDecision(forged, {
      type: 'rpsResolve',
      hand: playerHand,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.hand).toEqual(['A']);
  });
});
