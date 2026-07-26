import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { useMisreadFlowDriver } from '@/ui/hooks/useMisreadFlowDriver';
import { useGameStateStore } from '@/ui/state/store';

const { dispatchEngineAction } = vi.hoisted(() => ({ dispatchEngineAction: vi.fn() }));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({ dispatchEngineAction }));

function Harness(): null {
  useMisreadFlowDriver();
  return null;
}

describe('useMisreadFlowDriver', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    useGameStateStore.setState({ gameState: null, pendingMisread: null, spectatorMode: false });
    dispatchEngineAction.mockReset();
  });

  it('waits when opp is the human chooser', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    useGameStateStore.setState({
      gameState: createEmptyGameState(),
      pendingMisread: {
        player: 'opp',
        reasoningUid: 'reasoner#1',
        reasoningPlayer: 'self',
        candidates: [],
      },
    });
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness />));

    expect(dispatchEngineAction).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('auto-resolves instead of waiting when there is no human player', () => {
    useGameStateStore.setState({
      gameState: createEmptyGameState(),
      spectatorMode: true,
      pendingMisread: {
        player: 'self',
        reasoningUid: 'reasoner#1',
        reasoningPlayer: 'opp',
        candidates: [],
      },
    });
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness />));

    expect(dispatchEngineAction).toHaveBeenCalledWith({ type: 'misreadResolve', picks: [] });
    act(() => root.unmount());
  });
});
