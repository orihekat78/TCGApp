import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicHandRevealWindow } from '@/ui/components/PublicHandRevealWindow';
import { useGameStateStore } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('PublicHandRevealWindow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.setState({
      pendingPublicHandReveal: {
        owner: 'opp', audience: 'all', cardIds: ['D08015', 'D08015'], handSnapshot: ['D08015', 'D08015'],
        lifetime: 'effect', resolutionToken: 'public-hand-reveal:1', source: { cardId: 'B03111', abilityId: 'a1' },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => root.unmount());
    container.remove();
    useGameStateStore.setState({ pendingPublicHandReveal: null });
  });

  it('gives duplicate detail controls distinct accessible names with their occurrence and card name', () => {
    act(() => root.render(<PublicHandRevealWindow />));

    const first = container.querySelector<HTMLButtonElement>('[data-testid="public-hand-reveal-detail-0"]');
    const second = container.querySelector<HTMLButtonElement>('[data-testid="public-hand-reveal-detail-1"]');
    const cardName = container.querySelector('.public-hand-reveal-name')?.textContent;

    expect(cardName).toBeTruthy();
    expect(first?.getAttribute('aria-label')).toBe(`Details for ${cardName}, occurrence 1`);
    expect(second?.getAttribute('aria-label')).toBe(`Details for ${cardName}, occurrence 2`);
    expect(first?.getAttribute('aria-label')).not.toBe(second?.getAttribute('aria-label'));
  });

  it('dismisses a presentation window on its timer', () => {
    vi.useFakeTimers();
    useGameStateStore.setState((state) => ({
      pendingPublicHandReveal: state.pendingPublicHandReveal
        ? { ...state.pendingPublicHandReveal, lifetime: 'presentation' }
        : null,
    }));
    act(() => root.render(<PublicHandRevealWindow />));
    act(() => vi.advanceTimersByTime(1600));

    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    expect(container.querySelector('[data-testid="public-hand-reveal-window"]')).toBeNull();
  });
});
