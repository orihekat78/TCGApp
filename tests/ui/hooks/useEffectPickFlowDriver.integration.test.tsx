import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { run as runEffect } from '@/engine/effect/resolver';
import { startCausalSession } from '@/engine/log/causal';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { Effect, EffectCtx } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { useEffectPickFlowDriver } from '@/ui/hooks/useEffectPickFlowDriver';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function Harness(): null {
  useEffectPickFlowDriver();
  return null;
}

describe('useEffectPickFlowDriver real spectator dispatch', () => {
  beforeAll(() => registerAll());

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const state = createEmptyGameState();
    startCausalSession(state, 'spectator-stacked-card-pick');
    resetPresentationQueue('spectator-stacked-card-pick');
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      {
        ...sceneChar('B06005', 'agasa'),
        stackedCards: [
          { cardId: 'D08003', instanceId: 'stack:agasa:0' },
          { cardId: 'D08003', instanceId: 'stack:agasa:1' },
        ],
      },
      sceneChar('D08003', 'target'),
    ];
    useGameStateStore.setState({
      gameState: state,
      spectatorMode: false,
      pendingEffectPick: null,
    });
  });

  it('auto-resolves B06005 stacked-card selection and clears the surfaced decision', () => {
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'agasa', abilId: 'a2' }))
      .toMatchObject({ ok: true });
    const targetPending = useGameStateStore.getState().pendingEffectPick;
    expect(targetPending).not.toBeNull();
    expect(dispatchEngineAction(bindPendingDecision(
      targetPending!,
      { type: 'effectPickResolve', pickedUid: 'target' },
    )))
      .toMatchObject({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick).toMatchObject({
      player: 'self',
      atomVerb: 'stackedCardPick',
      source: { cardId: 'B06005', abilityId: 'a2' },
    });

    const root = createRoot(document.createElement('div'));
    try {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
      useGameStateStore.setState({ spectatorMode: true });
      act(() => root.render(<Harness />));

      const store = useGameStateStore.getState();
      expect(store.pendingEffectPick).toBeNull();
      const agasa = store.gameState?.players.self.scene.find((card) => card.uid === 'agasa');
      const target = store.gameState?.players.self.scene.find((card) => card.uid === 'target');
      expect(agasa?.stackedCards).toHaveLength(1);
      expect(target?.stackedCards).toEqual([
        { cardId: 'D08003', instanceId: 'stack:agasa:0' },
      ]);
    } finally {
      act(() => root.unmount());
      useGameStateStore.setState({ gameState: null, pendingEffectPick: null, spectatorMode: false });
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    }
  });

  it('auto-resolves every required card in a spectator multi-pick', () => {
    const state = createEmptyGameState();
    const sessionId = 'spectator-mandatory-multi-pick';
    startCausalSession(state, sessionId);
    resetPresentationQueue(sessionId);
    state.players.self.hand = ['D08003', 'D08005', 'D08007'];
    const effect: Effect = {
      kind: 'atom',
      verb: 'discard',
      args: { player: 'self', n: 2 },
    } as never;
    const ctx: EffectCtx = {
      source: { cardId: 'TEST', uid: 'test-source', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {},
    };
    runEffect(state, effect, ctx);
    runAllUntilEmpty(state);
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick).toMatchObject({ nMin: 2, nMax: 2 });

    const root = createRoot(document.createElement('div'));
    try {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
      useGameStateStore.setState({ spectatorMode: true });
      act(() => root.render(<Harness />));

      const store = useGameStateStore.getState();
      expect(store.pendingEffectPick).toBeNull();
      expect(store.gameState?.players.self.remove).toHaveLength(2);
      expect(store.gameState?.players.self.hand).toHaveLength(1);
    } finally {
      act(() => root.unmount());
      useGameStateStore.setState({ gameState: null, pendingEffectPick: null, spectatorMode: false });
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    }
  });
});
