import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeckPlaceModalHost } from '@/ui/components/DeckPlaceModalHost';
import { useGameStateStore } from '@/ui/state/store';

const { dispatchEngineActionMock } = vi.hoisted(() => ({ dispatchEngineActionMock: vi.fn() }));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({ dispatchEngineAction: dispatchEngineActionMock }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('DeckPlaceModalHost card details', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.setState({
      pendingDeckPlace: {
        ownerPlayer: 'self',
        cardIds: ['UNKNOWN-CARD', 'DUPLICATE-CARD', 'DUPLICATE-CARD'],
      },
    });
    dispatchEngineActionMock.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.getState().setPendingDeckPlace(null);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
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
    const duplicateTiles = tiles.filter((tile) => tile.dataset.cardId === 'DUPLICATE-CARD');
    const duplicateDetails = [...container.querySelectorAll<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]')]
      .filter((detail) => detail.parentElement?.querySelector('[data-card-id="DUPLICATE-CARD"]'));
    expect(duplicateTiles.map((tile) => tile.getAttribute('aria-label'))).toEqual(['DUPLICATE-CARD 1枚目を選択', 'DUPLICATE-CARD 2枚目を選択']);
    expect(duplicateDetails.map((detail) => detail.getAttribute('aria-label'))).toEqual(['DUPLICATE-CARD 1枚目の詳細を表示', 'DUPLICATE-CARD 2枚目の詳細を表示']);
    expect([...duplicateTiles, ...duplicateDetails].map((element) => element.getAttribute('aria-label')).join(' ')).not.toContain('DUPLICATE-CARD#');

    const details = container.querySelectorAll<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]');
    expect(details).toHaveLength(3);
    act(() => details[0]!.click());
    expect(container.querySelector('[aria-label^="カード拡大表示:"]')).not.toBeNull();
    act(() => (container.querySelector('.card-expand-close') as HTMLButtonElement).click());

    expect(container.querySelector('[data-testid="deck-place-row-0"]')?.textContent).toContain('DUPLICATE-CARD');
    expect(container.querySelector('[data-testid="deck-place-top-0"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-testid="deck-place-bottom-0"]')?.getAttribute('aria-pressed')).toBe('true');
    act(() => (container.querySelector('[data-testid="deck-place-confirm-btn"]') as HTMLButtonElement).click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({
      type: 'deckPlaceResolve',
      top: ['UNKNOWN-CARD', 'DUPLICATE-CARD'],
      bottom: ['DUPLICATE-CARD'],
    });
  });

  it('preserves dragged occurrence order in the deck-place payload', () => {
    act(() => root.render(<DeckPlaceModalHost />));
    const start = container.querySelector<HTMLElement>('[data-testid="deck-place-row-0"]')!;
    const target = container.querySelector<HTMLElement>('[data-testid="deck-place-row-2"]')!;
    act(() => start.dispatchEvent(new Event('dragstart', { bubbles: true })));
    act(() => target.dispatchEvent(new Event('drop', { bubbles: true })));

    expect([...container.querySelectorAll<HTMLElement>('[data-instance-id]')].map((tile) => tile.dataset.instanceId))
      .toEqual(['DUPLICATE-CARD#1', 'DUPLICATE-CARD#2', 'UNKNOWN-CARD#0']);
    act(() => (container.querySelector('[data-testid="deck-place-bottom-1"]') as HTMLButtonElement).click());
    act(() => (container.querySelector('[data-testid="deck-place-confirm-btn"]') as HTMLButtonElement).click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({
      type: 'deckPlaceResolve',
      top: ['DUPLICATE-CARD', 'UNKNOWN-CARD'],
      bottom: ['DUPLICATE-CARD'],
    });
  });

  it('renders when the opponent side is the actual human decision owner', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    act(() => {
      useGameStateStore.getState().setPendingDeckPlace({
        ownerPlayer: 'opp',
        cardIds: ['D08015'],
      });
      root.render(<DeckPlaceModalHost />);
    });

    expect(container.querySelector('[data-testid="deck-place-modal"]')).not.toBeNull();
  });

  it('registers its visible root and includes the MatchMenu trigger in both Tab directions', () => {
    act(() => root.render(
      <>
        <DeckPlaceModalHost />
        <button type="button" data-match-menu-trigger="true" data-testid="menu-trigger">Menu</button>
      </>,
    ));
    const modal = container.querySelector<HTMLElement>('[data-testid="deck-place-modal"]')!;
    const first = document.activeElement as HTMLElement;
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="menu-trigger"]')!;
    expect(modal.getAttribute('data-match-modal-registered')).toBe('true');

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true, cancelable: true,
    })));
    expect(document.activeElement).toBe(trigger);
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab', bubbles: true, cancelable: true,
    })));
    expect(document.activeElement).toBe(first);
  });
});
