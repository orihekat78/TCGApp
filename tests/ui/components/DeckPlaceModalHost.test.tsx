import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeckPlaceModalHost } from '@/ui/components/DeckPlaceModalHost';
import { useGameStateStore } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('DeckPlaceModalHost card details', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.setState({
      pendingDeckPlace: {
        ownerPlayer: 'self',
        cardIds: ['UNKNOWN-CARD', 'DUPLICATE-CARD', 'DUPLICATE-CARD'],
      },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.getState().setPendingDeckPlace(null);
  });

  it('keeps bucket assignment and duplicate occurrence identity after card details close', () => {
    act(() => root.render(<DeckPlaceModalHost />));
    act(() => (container.querySelector('[data-testid="deck-place-down-0"]') as HTMLButtonElement).click());
    act(() => (container.querySelector('[data-testid="deck-place-bottom-0"]') as HTMLButtonElement).click());

    const tiles = [...container.querySelectorAll<HTMLElement>('[data-instance-id]')];
    expect(tiles).toHaveLength(3);
    expect(new Set(tiles.map((tile) => tile.dataset.instanceId)).size).toBe(3);
    expect(container.querySelectorAll('.selectable-card-tile img')).toHaveLength(3);
    expect(container.querySelector<HTMLImageElement>('[data-card-id="UNKNOWN-CARD"] img')?.src)
      .toMatch(/^data:image\/svg\+xml/);
    expect(container.querySelector('button button')).toBeNull();

    const details = container.querySelectorAll<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]');
    expect(details).toHaveLength(3);
    act(() => details[0]!.click());
    expect(container.querySelector('[aria-label^="カード拡大表示:"]')).not.toBeNull();
    act(() => (container.querySelector('.card-expand-close') as HTMLButtonElement).click());

    expect(container.querySelector('[data-testid="deck-place-row-0"]')?.textContent).toContain('DUPLICATE-CARD');
    expect(container.querySelector('[data-testid="deck-place-top-0"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-testid="deck-place-bottom-0"]')?.getAttribute('aria-pressed')).toBe('true');
  });
});
