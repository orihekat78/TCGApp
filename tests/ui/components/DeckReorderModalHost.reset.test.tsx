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

  it('keeps duplicate occurrence identity and local order after card details close', () => {
    useGameStateStore.getState().setPendingDeckReorder({
      player: 'self',
      cardIds: ['UNKNOWN-CARD', 'DUPLICATE-CARD', 'DUPLICATE-CARD'],
    });
    act(() => root.render(<DeckReorderModalHost />));

    act(() => {
      (container.querySelector('[data-testid="deck-reorder-up-2"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="deck-reorder-row-1"]')?.textContent).toContain('DUPLICATE-CARD');

    const tiles = [...container.querySelectorAll<HTMLElement>('[data-instance-id]')];
    expect(tiles).toHaveLength(3);
    expect(new Set(tiles.map((tile) => tile.dataset.instanceId)).size).toBe(3);
    expect(container.querySelectorAll('.selectable-card-tile img')).toHaveLength(3);
    expect(container.querySelector<HTMLImageElement>('[data-card-id="UNKNOWN-CARD"] img')?.src)
      .toMatch(/^data:image\/svg\+xml/);
    expect(container.querySelector('button button')).toBeNull();

    const details = container.querySelectorAll<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]');
    expect(details).toHaveLength(3);
    act(() => details[1]!.click());
    expect(container.querySelector('[aria-label^="カード拡大表示:"]')).not.toBeNull();
    act(() => (container.querySelector('.card-expand-close') as HTMLButtonElement).click());

    expect(container.querySelector('[data-testid="deck-reorder-row-1"]')?.textContent).toContain('DUPLICATE-CARD');
  });
});
