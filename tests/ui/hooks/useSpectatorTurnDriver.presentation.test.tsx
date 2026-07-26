import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { makeChar } from '../../helpers/fixtures';
import { useGameStateStore } from '@/ui/state/store';

const { stepTurnMock } = vi.hoisted(() => ({ stepTurnMock: vi.fn() }));

vi.mock('@/ai/policy.js', () => ({ stepTurn: stepTurnMock }));

import {
  _resetSpectatorDriving,
  useSpectatorTurnDriver,
} from '@/ui/hooks/useSpectatorTurnDriver';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe(): null {
  useSpectatorTurnDriver();
  return null;
}

describe('spectator move presentation timing', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    stepTurnMock.mockReset();
    _resetSpectatorDriving();
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
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
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
});
