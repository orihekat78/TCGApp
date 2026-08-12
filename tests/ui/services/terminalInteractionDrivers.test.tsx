import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { useOppTurnDriver } from '@/ui/hooks/useOppTurnDriver';
import { useSpectatorTurnDriver } from '@/ui/hooks/useSpectatorTurnDriver';
import { beginMatchSession, commitMatchSession, resetMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function OppProbe(): null { useOppTurnDriver(); return null; }
function SpectatorProbe(): null { useSpectatorTurnDriver(); return null; }

describe('terminal interaction driver cleanup', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    resetMatchSession();
    vi.useRealTimers();
  });

  it('clears an already scheduled opponent timer without a late move after terminal commit', () => {
    const session = beginMatchSession('self');
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    expect(commitMatchSession(session, state)).toBe(true);
    useGameStateStore.getState().setAiSpeedMs(1_000);
    act(() => root.render(<OppProbe />));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    const terminal = structuredClone(state);
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    act(() => expect(commitMatchSession(session, terminal)).toBe(true));
    expect(vi.getTimerCount()).toBe(0);
    const terminalState = useGameStateStore.getState().gameState;
    const tickAfterTerminal = useGameStateStore.getState().oppMoveTick;
    act(() => vi.advanceTimersByTime(1_000));
    expect(useGameStateStore.getState().gameState).toBe(terminalState);
    expect(useGameStateStore.getState().oppMoveTick).toBe(tickAfterTerminal);
  });

  it('clears an already scheduled spectator timer without a late move after terminal commit', () => {
    const session = beginMatchSession(null);
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    expect(commitMatchSession(session, state)).toBe(true);
    useGameStateStore.getState().setSpectatorMode(true);
    useGameStateStore.getState().setAiSpeedMs(1_000);
    act(() => root.render(<SpectatorProbe />));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    const terminal = structuredClone(state);
    terminal.gameResult = { winner: 'opp', reason: 'evidence' };
    act(() => expect(commitMatchSession(session, terminal)).toBe(true));
    expect(vi.getTimerCount()).toBe(0);
    const terminalState = useGameStateStore.getState().gameState;
    const tickAfterTerminal = useGameStateStore.getState().oppMoveTick;
    act(() => vi.advanceTimersByTime(1_000));
    expect(useGameStateStore.getState().gameState).toBe(terminalState);
    expect(useGameStateStore.getState().oppMoveTick).toBe(tickAfterTerminal);
  });
});
