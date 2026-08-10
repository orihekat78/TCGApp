import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import {
  persistPendingRuntimeState,
  resetPendingRuntimeState,
} from '@/engine/effect/runtime-state';
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
