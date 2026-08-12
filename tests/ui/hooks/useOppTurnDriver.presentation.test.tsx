import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CausalLogEntryV1 } from '@/engine/types';
import { createEmptyGameState } from '@/engine/state-factory';
import { snapshotPendingRuntimeState } from '@/engine/effect/runtime-state';
import { useGameStateStore } from '@/ui/state/store';
import { getPresentationQueue, resetPresentationQueue } from '@/ui/presentation/coordinator';
import { startCausalSession } from '@/engine/log/causal';
import {
  beginMatchSession,
  endMatchSession,
  isMatchSessionActive,
  matchSessionId,
} from '@/ui/services/matchSession';
import {
  checkpointLiveReplayRecording,
  resetLiveReplayRecorderForTests,
} from '@/ui/services/liveReplayRecorder';

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

  it('restores the pre-step runtime when a natural terminal publish throws', () => {
    const store = useGameStateStore.getState();
    const before = store.gameState!;
    const terminal = structuredClone(before);
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    const runtime = globalThis as { __pendingContactStartAxId?: string };
    runtime.__pendingContactStartAxId = 'before-terminal-step';
    const runtimeBefore = snapshotPendingRuntimeState();
    stepTurnMock.mockImplementationOnce(() => {
      runtime.__pendingContactStartAxId = 'after-terminal-step';
      return {
        move: { kind: 'endTurn' },
        nextState: terminal,
        done: true,
      };
    });
    const unsubscribe = useGameStateStore.subscribe((next) => {
      if (next.gameState?.gameResult !== undefined) {
        throw new Error('opponent terminal subscriber failure');
      }
    });

    try {
      expect(() => driveOppTurn()).toThrow('opponent terminal subscriber failure');
      expect(useGameStateStore.getState().gameState).toBe(before);
      expect(snapshotPendingRuntimeState()).toEqual(runtimeBefore);
      expect(surfacePendingSideChannelsMock).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
      delete runtime.__pendingContactStartAxId;
    }
  });

  it('preserves a legitimate nested publication made while terminal rollback notifies', () => {
    resetLiveReplayRecorderForTests();
    const token = beginMatchSession('self');
    const before = createEmptyGameState();
    before.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    startCausalSession(before, matchSessionId(token));
    useGameStateStore.getState().setGameState(before);
    const storeBefore = useGameStateStore.getState();
    const replayBefore = checkpointLiveReplayRecording();
    const nested = { ...before, turn: { ...before.turn, number: before.turn.number + 1 } };
    const runtime = globalThis as { __pendingContactStartAxId?: string };
    let nestedRuntime: ReturnType<typeof snapshotPendingRuntimeState> | null = null;
    let nestedPublished = false;
    const nestedUnsubscribe = useGameStateStore.subscribe((state) => {
      if (nestedPublished || state !== storeBefore) return;
      nestedPublished = true;
      useGameStateStore.getState().setGameState(nested);
      runtime.__pendingContactStartAxId = 'nested-opponent-runtime';
      nestedRuntime = snapshotPendingRuntimeState();
    });
    const failingUnsubscribe = useGameStateStore.subscribe((state) => {
      if (state.gameState?.gameResult !== undefined) {
        throw new Error('opponent terminal rollback nested publication');
      }
    });
    const terminal = structuredClone(before);
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    stepTurnMock.mockImplementationOnce(() => {
      runtime.__pendingContactStartAxId = 'speculative-opponent-runtime';
      return { move: { kind: 'endTurn' }, nextState: terminal, done: true };
    });

    try {
      expect(() => driveOppTurn()).toThrow('opponent terminal rollback nested publication');
      expect(nestedPublished).toBe(true);
      expect(useGameStateStore.getState().gameState).toBe(nested);
      expect(snapshotPendingRuntimeState()).toEqual(nestedRuntime);
      expect(checkpointLiveReplayRecording()?.statesLength)
        .toBe((replayBefore?.statesLength ?? 0) + 1);
    } finally {
      failingUnsubscribe();
      nestedUnsubscribe();
      if (isMatchSessionActive()) endMatchSession();
      resetLiveReplayRecorderForTests();
      delete runtime.__pendingContactStartAxId;
    }
  });

  it('preserves nested UI state and runtime when rollback keeps the same GameState', () => {
    const before = useGameStateStore.getState().gameState!;
    const storeBefore = useGameStateStore.getState();
    const terminal = structuredClone(before);
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    const runtime = globalThis as { __pendingContactStartAxId?: string };
    runtime.__pendingContactStartAxId = 'before-same-state-rollback';
    let nestedRuntime: ReturnType<typeof snapshotPendingRuntimeState> | null = null;
    let nestedPublished = false;
    const nestedUnsubscribe = useGameStateStore.subscribe((state) => {
      if (nestedPublished || state !== storeBefore) return;
      nestedPublished = true;
      useGameStateStore.getState().setActiveCard('nested-card', 'nested publication');
      runtime.__pendingContactStartAxId = 'nested-same-state-runtime';
      nestedRuntime = snapshotPendingRuntimeState();
    });
    const failingUnsubscribe = useGameStateStore.subscribe((state) => {
      if (state.gameState?.gameResult !== undefined) {
        throw new Error('opponent same-state rollback publication');
      }
    });
    stepTurnMock.mockImplementationOnce(() => {
      runtime.__pendingContactStartAxId = 'speculative-same-state-runtime';
      return { move: { kind: 'endTurn' }, nextState: terminal, done: true };
    });

    try {
      expect(() => driveOppTurn()).toThrow('opponent same-state rollback publication');
      expect(nestedPublished).toBe(true);
      expect(useGameStateStore.getState()).toMatchObject({
        gameState: before,
        activeCardUid: 'nested-card',
        activeCardLabel: 'nested publication',
      });
      expect(snapshotPendingRuntimeState()).toEqual(nestedRuntime);
    } finally {
      failingUnsubscribe();
      nestedUnsubscribe();
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
