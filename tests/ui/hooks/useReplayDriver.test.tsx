import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplayLog } from '@/ai/replay/recorder';
import { createEmptyGameState } from '@/engine/state-factory';
import { useReplayDriver, type ReplayDriverApi } from '@/ui/hooks/useReplayDriver';
import { useGameStateStore } from '@/ui/state/store';

vi.mock('@/ai/replay/player.js', () => ({
  replayLog: (log: ReplayLog) => ({ finalState: structuredClone(log.initialState) }),
  ScriptedPolicy: class {},
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function makeLog(): ReplayLog {
  const initialState = createEmptyGameState();
  initialState.turn = {
    number: 1,
    player: 'self',
    phase: 'main',
    isFirstPlayerFirstTurn: false,
  };
  return {
    schemaVersion: 1,
    initialState,
    moves: [{ turn: 1, player: 'self', move: { kind: 'endTurn' } }],
    result: { winner: 'self', reason: 'turn-cap', turns: 1 },
  };
}

describe('useReplayDriver', () => {
  let container: HTMLDivElement;
  let root: Root;
  let driver: ReplayDriverApi | null;

  function ReplayProbe(): null {
    driver = useReplayDriver();
    return null;
  }

  function StoreProbe(): null {
    useGameStateStore((state) => state.gameState);
    return null;
  }

  beforeEach(() => {
    driver = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.getState().resetMatchSessionState();
    act(() => root.render(
      <>
        <ReplayProbe />
        <StoreProbe />
      </>,
    ));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not update the external game store from a React state updater', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    act(() => driver!.loadLog(makeLog()));
    errorSpy.mockClear();
    act(() => driver!.step());

    const renderedUpdateWarning = errorSpy.mock.calls.some((args) =>
      args.some((arg) =>
        typeof arg === 'string'
        && arg.includes('Cannot update a component')
        && arg.includes('while rendering a different component'),
      ),
    );
    expect(renderedUpdateWarning).toBe(false);
    expect(driver!.state.currentMoveIndex).toBe(1);
  });

  it('keeps autoplay store updates outside React state updaters', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    act(() => driver!.loadLog(makeLog()));
    errorSpy.mockClear();
    act(() => {
      driver!.setSpeed(10);
      driver!.play();
    });
    await act(async () => vi.advanceTimersByTime(10));

    const renderedUpdateWarning = errorSpy.mock.calls.some((args) =>
      args.some((arg) =>
        typeof arg === 'string'
        && arg.includes('Cannot update a component')
        && arg.includes('while rendering a different component'),
      ),
    );
    expect(renderedUpdateWarning).toBe(false);
    expect(driver!.state.currentMoveIndex).toBe(1);
  });
});
