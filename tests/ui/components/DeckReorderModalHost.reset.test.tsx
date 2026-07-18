import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeckReorderModalHost } from '@/ui/components/DeckReorderModalHost';
import { useGameStateStore } from '@/ui/state/store';
import { engine } from '@/engine';
import { getCardImagePlaceholder } from '@/ui/services/cardImage';

const { dispatchEngineActionMock } = vi.hoisted(() => ({ dispatchEngineActionMock: vi.fn() }));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({ dispatchEngineAction: dispatchEngineActionMock }));

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
    dispatchEngineActionMock.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.getState().setPendingDeckReorder(null);
    engine.cards._resetRegistry();
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

    const before = [...container.querySelectorAll<HTMLElement>('[data-instance-id]')]
      .map((tile) => tile.dataset.instanceId);
    expect(before).toEqual(['UNKNOWN-CARD#0', 'DUPLICATE-CARD#1', 'DUPLICATE-CARD#2']);

    act(() => {
      (container.querySelector('[data-testid="deck-reorder-down-0"]') as HTMLButtonElement).click();
    });
    const afterMove = [...container.querySelectorAll<HTMLElement>('[data-instance-id]')]
      .map((tile) => tile.dataset.instanceId);
    expect(afterMove).toEqual(['DUPLICATE-CARD#1', 'UNKNOWN-CARD#0', 'DUPLICATE-CARD#2']);

    const tiles = [...container.querySelectorAll<HTMLElement>('[data-instance-id]')];
    expect(tiles).toHaveLength(3);
    expect(new Set(tiles.map((tile) => tile.dataset.instanceId)).size).toBe(3);
    expect(container.querySelectorAll('.selectable-card-tile img')).toHaveLength(3);
    expect(container.querySelector<HTMLImageElement>('[data-card-id="UNKNOWN-CARD"] img')?.src)
      .toBe(getCardImagePlaceholder());
    expect(container.querySelector('button button')).toBeNull();
    const duplicateTiles = tiles.filter((tile) => tile.dataset.cardId === 'DUPLICATE-CARD');
    const duplicateDetails = [...container.querySelectorAll<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]')]
      .filter((detail) => detail.parentElement?.querySelector('[data-card-id="DUPLICATE-CARD"]'));
    expect(duplicateTiles.map((tile) => tile.getAttribute('aria-label'))).toEqual(['DUPLICATE-CARD 1枚目を選択', 'DUPLICATE-CARD 2枚目を選択']);
    expect(duplicateDetails.map((detail) => detail.getAttribute('aria-label'))).toEqual(['DUPLICATE-CARD 1枚目の詳細を表示', 'DUPLICATE-CARD 2枚目の詳細を表示']);
    expect([...duplicateTiles, ...duplicateDetails].map((element) => element.getAttribute('aria-label')).join(' ')).not.toContain('DUPLICATE-CARD#');

    const details = container.querySelectorAll<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]');
    expect(details).toHaveLength(3);
    act(() => details[1]!.click());
    expect(container.querySelector('[aria-label^="カード拡大表示:"]')).not.toBeNull();
    act(() => (container.querySelector('.card-expand-close') as HTMLButtonElement).click());

    const afterDetail = [...container.querySelectorAll<HTMLElement>('[data-instance-id]')]
      .map((tile) => tile.dataset.instanceId);
    expect(afterDetail).toEqual(afterMove);
    act(() => (container.querySelector('[data-testid="deck-reorder-confirm-btn"]') as HTMLButtonElement).click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({
      type: 'deckReorderResolve',
      order: ['DUPLICATE-CARD', 'UNKNOWN-CARD', 'DUPLICATE-CARD'],
    });
  });

  it('falls back after a visible card image errors', () => {
    engine.cards.register({
      id: 'BROKEN-IMAGE-CARD', no: '0001/BROKEN-IMAGE-CARD', kind: 'event', names: ['Broken image'],
      colors: [], level: 0, traits: [], keywords: [], rarity: 'C', imageUrl: 'broken-image.jpg', abilities: [], ruleRefs: [],
    });
    useGameStateStore.getState().setPendingDeckReorder({ player: 'self', cardIds: ['BROKEN-IMAGE-CARD'] });
    act(() => root.render(<DeckReorderModalHost />));

    const image = container.querySelector<HTMLImageElement>('[data-card-id="BROKEN-IMAGE-CARD"] img')!;
    expect(image.src).toContain('broken-image.jpg');
    act(() => image.dispatchEvent(new Event('error', { bubbles: true })));
    expect(image.src).toBe(getCardImagePlaceholder());
  });
});
