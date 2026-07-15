import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeckReorderModalHost } from '@/ui/components/DeckReorderModalHost';
import { useGameStateStore } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('DeckReorderModalHost consecutive decisions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.setState({
      pendingDeckReorder: { player: 'self', cardIds: ['A', 'B', 'C'] },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.getState().setPendingDeckReorder(null);
  });

  it('resets local order when a new pending decision has the same multiset', () => {
    act(() => root.render(<DeckReorderModalHost />));
    act(() => {
      (container.querySelector('[data-testid="deck-reorder-up-2"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="deck-reorder-row-1"]')?.textContent).toContain('C');

    act(() => {
      useGameStateStore.getState().setPendingDeckReorder({
        player: 'self',
        cardIds: ['A', 'B', 'C'],
      });
    });

    expect(container.querySelector('[data-testid="deck-reorder-row-1"]')?.textContent).toContain('B');
  });
});
