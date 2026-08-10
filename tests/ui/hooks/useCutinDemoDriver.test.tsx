import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CausalLogEntryV1, LegacyLogEntry } from '@/engine/types';
import { useCutinDemoDriver } from '@/ui/hooks/useCutinDemoDriver';
import { useGameStateStore } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe(): null {
  useCutinDemoDriver();
  return null;
}

function causalCutin(sessionId: string): CausalLogEntryV1 {
  return {
    schemaVersion: 1,
    eventId: `${sessionId}:1`,
    sessionId,
    sequence: 1,
    ts: 1,
    player: 'self',
    actor: 'self',
    turn: 1,
    action: 'use',
    kind: 'use',
    tags: ['contact', 'cutin'],
    source: { visibility: 'public', kind: 'player', label: 'あなた', side: 'self' },
    targets: [],
    outcome: { type: 'state', state: 'success' },
  };
}

function legacyCutin(): LegacyLogEntry {
  return {
    ts: 1,
    player: 'self',
    turn: 1,
    action: 'contact-cutin',
  };
}

describe('useCutinDemoDriver', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    useGameStateStore.getState().resetMatchSessionState();
    useGameStateStore.setState({ gameState: createEmptyGameState() });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Probe />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.getState().resetMatchSessionState();
    vi.useRealTimers();
  });

  it('causal use event tagged contact/cutin completes the current demo run', async () => {
    act(() => useGameStateStore.getState().setCutinDemoMode('playing'));
    const state = createEmptyGameState();
    state.log = [causalCutin('cutin-demo-causal')];
    act(() => useGameStateStore.setState({ gameState: state }));

    await act(async () => vi.advanceTimersByTime(399));
    expect(useGameStateStore.getState().cutinDemoMode).toBe('playing');
    await act(async () => vi.advanceTimersByTime(1));
    expect(useGameStateStore.getState().cutinDemoMode).toBe('completed');
  });

  it('a stale completion timer from run A cannot complete run B', async () => {
    act(() => useGameStateStore.getState().setCutinDemoMode('playing'));
    const runA = createEmptyGameState();
    runA.log = [legacyCutin()];
    act(() => useGameStateStore.setState({ gameState: runA }));

    act(() => {
      useGameStateStore.getState().resetMatchSessionState();
      useGameStateStore.setState({ gameState: createEmptyGameState() });
      useGameStateStore.getState().setCutinDemoMode('playing');
    });
    await act(async () => vi.advanceTimersByTime(400));

    expect(useGameStateStore.getState().cutinDemoMode).toBe('playing');
  });
});
