import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecentActionToast } from '@/ui/components/RecentActionToast';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { useGameStateStore } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('RecentActionToast', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    resetPresentationQueue('toast-test-session');
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const gameState = createSampleGameState();
    gameState.log = [{ ts: 1, player: 'self', turn: 1, action: 'handUseCard', target: 'D08003' }];
    useGameStateStore.setState({ gameState });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.setState({ gameState: null });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    vi.useRealTimers();
  });

  it('announces the visible action without taking pointer input from the board', async () => {
    await act(async () => {
      root.render(<RecentActionToast />);
    });

    const toast = container.querySelector<HTMLElement>('[data-testid="recent-action-toast"]');
    expect(toast).not.toBeNull();
    expect(toast?.getAttribute('role')).toBe('status');
    expect(getComputedStyle(toast!).pointerEvents).toBe('none');
  });

  it('does not announce a private target to the other player', async () => {
    const gameState = createSampleGameState();
    gameState.log = [{
      ts: 1,
      player: 'opp',
      turn: 1,
      action: 'effect:evidencePeek',
      target: 'PRIVATE-EVIDENCE',
      targetAudience: 'opp',
    }];
    useGameStateStore.setState({ gameState });

    await act(async () => {
      root.render(<RecentActionToast />);
    });

    const toast = container.querySelector<HTMLElement>('[data-testid="recent-action-toast"]');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).not.toContain('PRIVATE-EVIDENCE');
  });

  it('shows only the newest event from one update and does not run a second FIFO', async () => {
    const gameState = createSampleGameState();
    gameState.log = [];
    useGameStateStore.setState({ gameState });
    await act(async () => root.render(<RecentActionToast />));

    const updated = structuredClone(gameState);
    updated.log.push(
      { ts: 10, player: 'self', turn: 1, action: 'first-action' },
      { ts: 11, player: 'opp', turn: 1, action: 'second-action' },
    );
    await act(async () => useGameStateStore.setState({ gameState: updated }));

    expect(container.textContent).toContain('second-action');
    expect(container.textContent).not.toContain('first-action');
    await act(async () => vi.advanceTimersByTimeAsync(1_500));
    expect(container.querySelector('[data-testid="recent-action-toast"]')).toBeNull();
  });

  it('invalidates an equal-length toast cursor when the presentation session changes', async () => {
    const first = createSampleGameState();
    first.log = [{ ts: 10, player: 'self', turn: 1, action: 'session-one' }];
    resetPresentationQueue('toast-session-one');
    useGameStateStore.setState({ gameState: first });
    await act(async () => root.render(<RecentActionToast />));
    expect(container.textContent).toContain('session-one');

    const second = createSampleGameState();
    second.log = [{ ts: 10, player: 'opp', turn: 1, action: 'session-two' }];
    resetPresentationQueue('toast-session-two');
    await act(async () => useGameStateStore.setState({ gameState: second }));

    expect(container.textContent).toContain('session-two');
    expect(container.textContent).not.toContain('session-one');
  });

  it('clears the visible event while replay presentation is suppressed', async () => {
    await act(async () => root.render(<RecentActionToast suppressed={false} />));
    expect(container.querySelector('[data-testid="recent-action-toast"]')).not.toBeNull();

    await act(async () => root.render(<RecentActionToast suppressed />));
    expect(container.querySelector('[data-testid="recent-action-toast"]')).toBeNull();
  });
});
