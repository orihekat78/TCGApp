import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _peekPendingEffectOptionalSide,
  resolveEffectPicks,
} from '@/engine/effect/resolve-picks';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import type { Effect, EffectCtx, GameState } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
} from '@/ui/hooks/useEngineDispatch';
import { useEffectPickFlowDriver } from '@/ui/hooks/useEffectPickFlowDriver';
import { selectAutonomousDecisionBlocked } from '@/ui/state/autonomousDecisionGate';
import { useGameStateStore } from '@/ui/state/store';

const optionalDraw: Effect = {
  kind: 'optional',
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

const optionalThenTail: Effect = {
  kind: 'sequence',
  steps: [
    optionalDraw,
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ],
};

const effectCtx: EffectCtx = {
  source: {
    player: 'opp',
    area: 'scene',
    cardId: 'WAVE23-OPTIONAL',
    uid: 'wave23-optional#1',
    abilityId: 'owner-boundary',
  },
  bindings: {},
};

function persistedOpponentOptional(): GameState {
  const state = createEmptyGameState();
  state.turn = {
    number: 5,
    player: 'opp',
    phase: 'main',
    isFirstPlayerFirstTurn: false,
  };
  state.players.opp.deck = ['TAIL', 'OPTIONAL', 'RESERVE'];

  runEffect(state, resolveEffectPicks(state, optionalThenTail, effectCtx, {
    byPlayer: 'opp',
    humanChooser: true,
    source: { cardId: 'WAVE23-OPTIONAL', abilityId: 'owner-boundary' },
  }), effectCtx);
  runAllUntilEmpty(state);

  expect(state.pendingRuntimeState, 'pause boundary must be persisted').toBeDefined();
  resetPendingRuntimeState();
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function Harness(): null {
  useEffectPickFlowDriver();
  return null;
}

describe('Wave 23: restored decision owner reconciliation', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useGameStateStore.getState().setGameState(null);
    resetPendingRuntimeState();
    _setHumanPlayerSide(null);
  });

  afterEach(() => {
    useGameStateStore.getState().setGameState(null);
    resetPendingRuntimeState();
    _setHumanPlayerSide(null);
  });

  it('surfaces and autonomously declines a restored opponent optional before continuing', () => {
    const restored = persistedOpponentOptional();
    _setHumanPlayerSide('self');

    expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
    expect(useGameStateStore.getState().pendingEffectOptional).toMatchObject({ player: 'opp' });
    expect(selectAutonomousDecisionBlocked(useGameStateStore.getState())).toBe(true);
    const root = createRoot(document.createElement('div'));

    try {
      act(() => root.render(createElement(Harness)));

      const store = useGameStateStore.getState();
      expect(store.gameState?.players.opp.hand).toEqual(['TAIL']);
      expect(store.pendingEffectOptional).toBeNull();
      expect(store.gameState?.pendingRuntimeState).toBeUndefined();
      expect(_peekPendingEffectOptionalSide()).toBeNull();
      expect(selectAutonomousDecisionBlocked(store)).toBe(false);
    } finally {
      act(() => root.unmount());
    }
  });

  it('waits for the matching human before resolving the restored optional', () => {
    const restored = persistedOpponentOptional();
    _setHumanPlayerSide('opp');
    expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
    const pending = useGameStateStore.getState().pendingEffectOptional;
    expect(pending?.player).toBe('opp');
    const root = createRoot(document.createElement('div'));

    try {
      act(() => root.render(createElement(Harness)));
      expect(useGameStateStore.getState().pendingEffectOptional).toEqual(pending);
      expect(useGameStateStore.getState().gameState?.players.opp.hand).toEqual([]);

      act(() => {
        expect(dispatchEngineAction(bindPendingDecision(
          pending!,
          { type: 'optionalResolve', run: true },
        ))).toEqual({ ok: true });
      });
      expect(useGameStateStore.getState().gameState?.players.opp.hand)
        .toEqual(['TAIL', 'OPTIONAL']);
    } finally {
      act(() => root.unmount());
    }
  });
});
