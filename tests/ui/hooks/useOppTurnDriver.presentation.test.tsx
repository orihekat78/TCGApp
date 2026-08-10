import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CausalLogEntryV1 } from '@/engine/types';
import { createEmptyGameState } from '@/engine/state-factory';
import { snapshotPendingRuntimeState } from '@/engine/effect/runtime-state';
import { useGameStateStore } from '@/ui/state/store';
import { getPresentationQueue, resetPresentationQueue } from '@/ui/presentation/coordinator';

const { stepTurnMock } = vi.hoisted(() => ({ stepTurnMock: vi.fn() }));
const { surfacePendingSideChannelsMock } = vi.hoisted(() => ({
  surfacePendingSideChannelsMock: vi.fn(),
}));

vi.mock('@/ai/policy.js', () => ({ stepTurn: stepTurnMock }));
vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({
  dispatchEngineAction: vi.fn(),
  surfacePendingSideChannels: surfacePendingSideChannelsMock,
}));

import {
  driveOppTurn,
  useOppTurnDriver,
  _resetIsDriving,
} from '@/ui/hooks/useOppTurnDriver';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ enabled }: { enabled: boolean }): null {
  useOppTurnDriver(enabled);
  return null;
}

describe('opponent autonomous presentation guard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    stepTurnMock.mockReset();
    surfacePendingSideChannelsMock.mockReset();
    _resetIsDriving();
    resetPresentationQueue('opp-driver-presentation');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    useGameStateStore.setState({
      gameState: state,
      aiSpeedMs: 0,
      isAiPaused: false,
      aiStepCounter: 0,
      activeActionId: null,
      pendingHirameki: null,
      pendingMisread: null,
      pendingEffectPick: null,
      pendingEffectChoice: null,
      pendingEffectOptional: null,
      pendingRps: null,
      pendingChooseIntercept: null,
      pendingLeaveIntercept: null,
      pendingSetCardChoice: null,
      pendingSetCardReplacement: null,
      pendingEffectRepeatOptional: null,
      pendingDeckReveal: null,
      pendingPublicHandReveal: null,
      pendingDeckReorder: null,
      pendingDeckPlace: null,
    });
    const completed = structuredClone(state);
    completed.gameResult = { winner: 'self', reason: 'evidence' };
    stepTurnMock.mockReturnValue({
      move: { kind: 'endTurn' },
      nextState: completed,
      done: true,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    resetPresentationQueue('opp-driver-cleanup');
    vi.useRealTimers();
  });

  it('waits for the current presentation, then starts exactly one next opponent step', async () => {
    const epoch = enqueuePresentation();

    act(() => root.render(<Probe enabled />));
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(stepTurnMock).not.toHaveBeenCalled();

    act(() => {
      expect(getPresentationQueue().completeCurrent(epoch)).toBe(true);
    });
    await act(async () => vi.advanceTimersByTime(0));
    expect(stepTurnMock).toHaveBeenCalledOnce();
  });

  it('rechecks the queue when a scheduled opponent callback executes', async () => {
    act(() => root.render(<Probe enabled />));
    act(() => {
      enqueuePresentation();
      // The execution guard is the final race boundary even when a timer was
      // already scheduled before a presentation event arrived.
      driveOppTurn();
    });
    await act(async () => vi.advanceTimersByTime(0));
    expect(stepTurnMock).not.toHaveBeenCalled();
  });

  it('does not advance while a Hirameki decision remains unresolved', async () => {
    useGameStateStore.setState({
      pendingHirameki: { player: 'opp', cardId: 'D08013', abilityId: 'a2' },
    });

    act(() => root.render(<Probe enabled />));
    await act(async () => vi.advanceTimersByTime(5_000));

    expect(stepTurnMock).not.toHaveBeenCalled();
  });

  it('rolls back pending runtime without UI side effects when a step commit is rejected', async () => {
    const store = useGameStateStore.getState();
    const before = store.gameState!;
    const runtime = globalThis as { __pendingContactStartAxId?: string };
    runtime.__pendingContactStartAxId = 'before-step';
    const runtimeBefore = snapshotPendingRuntimeState();
    const setGameState = vi.spyOn(store, 'setGameState').mockImplementation(() => false);
    stepTurnMock.mockImplementationOnce(() => {
      runtime.__pendingContactStartAxId = 'after-step';
      return {
        move: { kind: 'reasoning', uid: 'opp-card' },
        nextState: structuredClone(before),
        done: false,
      };
    });

    try {
      act(() => root.render(<Probe enabled />));
      await act(async () => vi.advanceTimersByTime(0));

      expect(snapshotPendingRuntimeState()).toEqual(runtimeBefore);
      expect(surfacePendingSideChannelsMock).not.toHaveBeenCalled();
      expect(useGameStateStore.getState()).toMatchObject({
        gameState: before,
        activeCardUid: null,
        activeCardLabel: null,
      });
    } finally {
      setGameState.mockRestore();
      delete runtime.__pendingContactStartAxId;
    }
  });

  it('rolls back pending runtime without terminal follow-up when a terminal commit is rejected', async () => {
    const store = useGameStateStore.getState();
    const before = store.gameState!;
    const runtime = globalThis as { __pendingContactStartAxId?: string };
    runtime.__pendingContactStartAxId = 'before-terminal';
    const runtimeBefore = snapshotPendingRuntimeState();
    const setGameState = vi.spyOn(store, 'setGameState').mockImplementation(() => false);
    const dispatch = vi.spyOn(store, 'dispatch').mockImplementation(() => false);
    stepTurnMock.mockImplementationOnce(() => {
      runtime.__pendingContactStartAxId = 'after-terminal';
      return {
        move: { kind: 'endTurn' },
        nextState: structuredClone(before),
        done: true,
      };
    });

    try {
      act(() => root.render(<Probe enabled />));
      await act(async () => vi.advanceTimersByTime(0));

      expect(snapshotPendingRuntimeState()).toEqual(runtimeBefore);
      expect(surfacePendingSideChannelsMock).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
      expect(useGameStateStore.getState()).toMatchObject({
        gameState: before,
        activeCardUid: null,
        activeCardLabel: null,
      });
    } finally {
      dispatch.mockRestore();
      setGameState.mockRestore();
      delete runtime.__pendingContactStartAxId;
    }
  });

  it('does not advance a replay-owned opponent turn when disabled', async () => {
    const replayState = useGameStateStore.getState().gameState;
    act(() => root.render(<Probe enabled={false} />));
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(useGameStateStore.getState().gameState).toBe(replayState);
    expect(useGameStateStore.getState().gameState?.turn.player).toBe('opp');
  });
});

function enqueuePresentation(): number {
  const event: CausalLogEntryV1 = {
    schemaVersion: 1,
    eventId: 'opp-driver-presentation:1',
    sessionId: 'opp-driver-presentation',
    sequence: 1,
    ts: 1,
    turn: 2,
    player: 'opp',
    actor: 'opp',
    action: 'causal.draw',
    kind: 'draw',
    targets: [],
    outcome: { type: 'count', amount: 1, unit: 'card' },
    result: '1:card',
  };
  const queue = getPresentationQueue();
  queue.enqueue(event, [event]);
  return queue.currentEpoch();
}
