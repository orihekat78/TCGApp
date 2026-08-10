import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { useHiramekiFlowDriver } from '@/ui/hooks/useHiramekiFlowDriver';
import { useGameStateStore } from '@/ui/state/store';

const { dispatchEngineAction } = vi.hoisted(() => ({ dispatchEngineAction: vi.fn() }));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({ dispatchEngineAction }));

function Harness({ enabled = true }: { enabled?: boolean }): null {
  useHiramekiFlowDriver(enabled);
  return null;
}

describe('useHiramekiFlowDriver', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    useGameStateStore.setState({
      gameState: null,
      pendingHirameki: null,
      spectatorMode: false,
    });
    dispatchEngineAction.mockReset();
  });

  it('waits when self is the human chooser', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    useGameStateStore.setState({
      gameState: createEmptyGameState(),
      pendingHirameki: { player: 'self', cardId: 'D08013', abilityId: 'a2' },
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
      pendingHirameki: { player: 'self', cardId: 'D08013', abilityId: 'a2' },
    });
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness />));

    expect(dispatchEngineAction).toHaveBeenCalledWith({
      type: 'hiramekiResolve',
      choice: expect.stringMatching(/^(fire|skip)$/),
    });
    act(() => root.unmount());
  });

  it.each([
    { label: 'opponent-owned in a human match', spectatorMode: false, humanSide: 'self' as const, player: 'opp' as const },
    { label: 'opponent-owned in spectator mode', spectatorMode: true, humanSide: null, player: 'opp' as const },
  ])('auto-resolves $label Hirameki', ({ spectatorMode, humanSide, player }) => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = humanSide;
    useGameStateStore.setState({
      gameState: createEmptyGameState(),
      spectatorMode,
      pendingHirameki: { player, cardId: 'D08013', abilityId: 'a2' },
    });
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness />));

    expect(dispatchEngineAction).toHaveBeenCalledWith({
      type: 'hiramekiResolve',
      choice: expect.stringMatching(/^(fire|skip)$/),
    });
    act(() => root.unmount());
  });

  it('clears a terminal Hirameki without dispatching a new engine action', () => {
    const terminal = createEmptyGameState();
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({
      gameState: terminal,
      spectatorMode: true,
      pendingHirameki: { player: 'self', cardId: 'D08013', abilityId: 'a2' },
    });
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness />));

    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
    expect(dispatchEngineAction).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('does not resolve while the live flow is disabled for read-only replay', () => {
    useGameStateStore.setState({
      gameState: createEmptyGameState(),
      spectatorMode: true,
      pendingHirameki: { player: 'self', cardId: 'D08013', abilityId: 'a2' },
    });
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness enabled={false} />));

    expect(dispatchEngineAction).not.toHaveBeenCalled();
    expect(useGameStateStore.getState().pendingHirameki).not.toBeNull();
    act(() => root.unmount());
  });
});
