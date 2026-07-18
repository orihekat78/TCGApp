import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RecentActionToast } from '@/ui/components/RecentActionToast';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import { useGameStateStore } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('RecentActionToast', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
});
