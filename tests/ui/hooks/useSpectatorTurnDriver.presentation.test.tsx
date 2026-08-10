import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CausalLogEntryV1 } from '@/engine/types';
import { createEmptyGameState } from '@/engine/state-factory';
import { snapshotPendingRuntimeState } from '@/engine/effect/runtime-state';
import { makeChar } from '../../helpers/fixtures';
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
  _resetSpectatorDriving,
  useSpectatorTurnDriver,
} from '@/ui/hooks/useSpectatorTurnDriver';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ enabled = true }: { enabled?: boolean }): null {
  useSpectatorTurnDriver(enabled);
  return null;
}

describe('spectator move presentation timing', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    stepTurnMock.mockReset();
    surfacePendingSideChannelsMock.mockReset();
    _resetSpectatorDriving();
    resetPresentationQueue('spectator-driver-presentation');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    useGameStateStore.setState({
      gameState: state,
      spectatorMode: true,
      aiSpeedMs: 400,
      isAiPaused: false,
      aiStepCounter: 0,
      oppMoveTick: 0,
      activeActionId: null,
      activeCardUid: null,
      activeCardLabel: null,
      pendingDeckReveal: null,
      pendingPublicHandReveal: null,
      pendingEffectPick: null,
      pendingEffectChoice: null,
      pendingEffectOptional: null,
      pendingChooseIntercept: null,
      pendingLeaveIntercept: null,
      pendingSetCardChoice: null,
      pendingSetCardReplacement: null,
      pendingEffectRepeatOptional: null,
      pendingHirameki: null,
      pendingMisread: null,
      pendingDeckReorder: null,
      pendingDeckPlace: null,
      pendingRps: null,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    resetPresentationQueue('spectator-driver-cleanup');
    vi.useRealTimers();
  });

  it('waits for the current presentation, then starts exactly one next spectator step', async () => {
    const before = useGameStateStore.getState().gameState!;
    const completed = structuredClone(before);
    completed.gameResult = { winner: 'opp', reason: 'evidence' };
    stepTurnMock.mockReturnValue({
      move: { kind: 'endTurn' },
      nextState: completed,
      done: true,
    });
    const epoch = enqueuePresentation();

    act(() => root.render(<Probe />));
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(stepTurnMock).not.toHaveBeenCalled();

    act(() => {
      expect(getPresentationQueue().completeCurrent(epoch)).toBe(true);
    });
    await act(async () => vi.advanceTimersByTime(0));
    expect(stepTurnMock).toHaveBeenCalledOnce();
  });

  it('rechecks the queue when a scheduled spectator callback executes', async () => {
    const before = useGameStateStore.getState().gameState!;
    stepTurnMock.mockReturnValue({
      move: { kind: 'endTurn' },
      nextState: before,
      done: true,
    });

    act(() => root.render(<Probe />));
    act(() => {
      enqueuePresentation();
    });
    await act(async () => vi.advanceTimersByTime(0));
    expect(stepTurnMock).not.toHaveBeenCalled();
  });

  it('sets the self active card before waiting the configured interval after an important move', async () => {
    const before = useGameStateStore.getState().gameState!;
    const after = structuredClone(before);
    after.players.self.scene = [makeChar({ cardId: 'NEW', uid: 'self-new', enterOrder: 0 })];
    stepTurnMock
      .mockReturnValueOnce({
        move: { kind: 'handUseCard', cardId: 'NEW' },
        nextState: after,
        done: false,
      })
      .mockReturnValueOnce({ move: { kind: 'endTurn' }, nextState: after, done: true });

    act(() => root.render(<Probe />));
    await act(async () => vi.advanceTimersByTime(0));

    expect(stepTurnMock).toHaveBeenCalledOnce();
    expect(useGameStateStore.getState()).toMatchObject({
      activeCardUid: 'self-new',
      activeCardLabel: '登場',
    });
    await act(async () => vi.advanceTimersByTime(399));
    expect(stepTurnMock).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTime(1));
    expect(stepTurnMock).toHaveBeenCalledTimes(2);
  });

  it('shows a routine self move and schedules the next step at 0ms', async () => {
    const before = useGameStateStore.getState().gameState!;
    const after = structuredClone(before);
    after.players.self.scene = [makeChar({ cardId: 'R', uid: 'self-r', enterOrder: 0 })];
    stepTurnMock
      .mockReturnValueOnce({
        move: { kind: 'reasoning', uid: 'self-r' },
        nextState: after,
        done: false,
      })
      .mockReturnValueOnce({ move: { kind: 'endTurn' }, nextState: after, done: true });

    act(() => root.render(<Probe />));
    await act(async () => vi.advanceTimersByTime(0));

    expect(useGameStateStore.getState()).toMatchObject({
      activeCardUid: 'self-r',
      activeCardLabel: '推理',
    });
    expect(stepTurnMock).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTime(0));
    expect(stepTurnMock).toHaveBeenCalledTimes(2);
  });

  it('does not advance while a public deck reveal is visible', async () => {
    const before = useGameStateStore.getState().gameState!;
    stepTurnMock.mockReturnValue({
      move: { kind: 'endTurn' },
      nextState: before,
      done: true,
    });
    useGameStateStore.setState({
      pendingDeckReveal: {
        player: 'self',
        visibility: 'public',
        viewer: 'all',
        revealed: ['VISIBLE'],
        matched: 'VISIBLE',
        presentation: 'reveal-return',
      },
    });

    act(() => root.render(<Probe />));
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(stepTurnMock).not.toHaveBeenCalled();

    act(() => useGameStateStore.getState().setPendingDeckReveal(null));
    await act(async () => vi.advanceTimersByTime(0));
    expect(stepTurnMock).toHaveBeenCalledOnce();
  });

  it.each([
    {
      label: 'Hirameki',
      state: { pendingHirameki: { player: 'self', cardId: 'D08013', abilityId: 'a2' } },
    },
    {
      label: 'effect pick',
      state: {
        pendingEffectPick: {
          player: 'self', candidates: [], atomVerb: 'stackedCardPick', atomArgs: {},
          nMin: 0, nMax: 1, source: { cardId: 'B06005', abilityId: 'a2' },
        },
      },
    },
  ])('does not schedule another AI move while a $label decision is unresolved', async ({ state }) => {
    stepTurnMock.mockReturnValue({
      move: { kind: 'endTurn' },
      nextState: useGameStateStore.getState().gameState!,
      done: true,
    });
    useGameStateStore.setState(state as never);

    act(() => root.render(<Probe />));
    await act(async () => vi.advanceTimersByTime(5_000));

    expect(stepTurnMock).not.toHaveBeenCalled();
  });

  it('does not advance a replay-owned board when autonomous driving is disabled', async () => {
    stepTurnMock.mockReturnValue({
      move: { kind: 'endTurn' },
      nextState: useGameStateStore.getState().gameState!,
      done: true,
    });

    act(() => root.render(<Probe enabled={false} />));
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(stepTurnMock).not.toHaveBeenCalled();
  });

  it('rolls back pending runtime without UI side effects when a spectator step commit is rejected', async () => {
    const store = useGameStateStore.getState();
    const before = store.gameState!;
    const runtime = globalThis as { __pendingContactStartAxId?: string };
    runtime.__pendingContactStartAxId = 'before-step';
    const runtimeBefore = snapshotPendingRuntimeState();
    const setGameState = vi.spyOn(store, 'setGameState').mockImplementation(() => false);
    stepTurnMock.mockImplementationOnce(() => {
      runtime.__pendingContactStartAxId = 'after-step';
      return {
        move: { kind: 'reasoning', uid: 'self-card' },
        nextState: structuredClone(before),
        done: false,
      };
    });

    try {
      act(() => root.render(<Probe />));
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

  it('rolls back pending runtime without terminal follow-up when a spectator terminal commit is rejected', async () => {
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
      act(() => root.render(<Probe />));
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
});

function enqueuePresentation(): number {
  const event: CausalLogEntryV1 = {
    schemaVersion: 1,
    eventId: 'spectator-driver-presentation:1',
    sessionId: 'spectator-driver-presentation',
    sequence: 1,
    ts: 1,
    turn: 2,
    player: 'self',
    actor: 'self',
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
