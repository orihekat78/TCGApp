import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { engine } from '@/engine';
import { SelectableCardTile } from '@/ui/components/SelectableCardTile';

const CSS_SOURCE = readFileSync(
  resolve(process.cwd(), 'src/ui/components/SelectableCardTile.css'),
  'utf8',
);

function registerPublicCard(): void {
  engine.cards.register({
    id: 'PUBLIC-CARD',
    no: '0001/PUBLIC-CARD',
    kind: 'character',
    names: ['Known Card'],
    colors: ['blue'],
    level: 1,
    ap: 1000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: 'public-card.jpg',
    abilities: [],
    ruleRefs: [],
  });
}

function renderTile(props: Partial<React.ComponentProps<typeof SelectableCardTile>> = {}) {
  const container = document.createElement('div');
  const root = createRoot(container);
  const onSelect = vi.fn();
  const onExpand = vi.fn();
  act(() => {
    root.render(
      <SelectableCardTile
        cardId="B01001"
        instanceId="hand:self:2"
        onSelect={onSelect}
        onExpand={onExpand}
        {...props}
      />,
    );
  });
  return { container, root, onSelect, onExpand };
}

function unmount(root: Root): void {
  act(() => root.unmount());
}

describe('SelectableCardTile', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
  });

  it('renders the public name and falls back to an unknown card id', () => {
    registerPublicCard();
    const known = renderTile({ cardId: 'PUBLIC-CARD' });

    expect(known.container.querySelector('.selectable-card-tile__name')?.textContent).toBe('Known Card');
    expect(known.container.querySelector('img.card-art')).not.toBeNull();
    unmount(known.root);

    const unknown = renderTile({ cardId: 'UNKNOWN-CARD' });
    expect(unknown.container.querySelector('.selectable-card-tile__name')?.textContent).toBe('UNKNOWN-CARD');
    unmount(unknown.root);
  });

  it('renders public card art and recognition metadata', () => {
    const { container, root } = renderTile();

    expect(container.querySelector('img.card-art')).not.toBeNull();
    expect(container.textContent).toContain('B01001');
    unmount(root);
  });

  it('uses the instance id as its DOM identity and selection value for duplicate card ids', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onSelect = vi.fn();

    act(() => {
      root.render(
        <>
          <SelectableCardTile cardId="B01001" instanceId="hand:self:1" onSelect={onSelect} />
          <SelectableCardTile cardId="B01001" instanceId="hand:self:2" onSelect={onSelect} />
        </>,
      );
    });

    const second = container.querySelector<HTMLElement>('[data-instance-id="hand:self:2"]');
    const instanceIds = [...container.querySelectorAll<HTMLElement>('[data-instance-id]')]
      .map((tile) => tile.dataset.instanceId);
    expect(container.querySelectorAll('[data-card-id="B01001"]')).toHaveLength(2);
    expect(new Set(instanceIds).size).toBe(2);
    expect(instanceIds).toEqual(['hand:self:1', 'hand:self:2']);
    expect(second).not.toBeNull();
    if (!second) return;
    act(() => second!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onSelect).toHaveBeenCalledWith('hand:self:2');
    unmount(root);
  });

  it('uses sibling native buttons for primary selection and details', () => {
    const { container, root, onSelect, onExpand } = renderTile();
    const tile = container.querySelector<HTMLButtonElement>('[data-instance-id="hand:self:2"]')!;
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]')!;

    expect(container.querySelector('button button')).toBeNull();
    expect(tile).toBeInstanceOf(HTMLButtonElement);
    expect(detail).toBeInstanceOf(HTMLButtonElement);
    expect(tile).not.toBeNull();
    expect(detail).not.toBeNull();
    if (!tile || !detail) return;
    expect(tile.parentElement).toBe(detail.parentElement);
    act(() => detail.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onExpand).toHaveBeenCalledWith('B01001');
    expect(onSelect).not.toHaveBeenCalled();
    act(() => tile.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onSelect).toHaveBeenCalledWith('hand:self:2');
    unmount(root);
  });

  it('opens public card details from a right click without selecting', () => {
    const { container, root, onSelect, onExpand } = renderTile();
    const tile = container.querySelector<HTMLElement>('[data-instance-id="hand:self:2"]')!;

    expect(tile).not.toBeNull();
    if (!tile) return;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => tile.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(onExpand).toHaveBeenCalledWith('B01001');
    expect(onSelect).not.toHaveBeenCalled();
    unmount(root);
  });

  it('does not disclose hidden card data through DOM text or accessibility', () => {
    registerPublicCard();
    const { container, root, onSelect, onExpand } = renderTile({
      cardId: 'PUBLIC-CARD',
      hidden: true,
      hiddenLabel: 'Set card 2',
    });
    const tile = container.querySelector<HTMLElement>('[data-instance-id="hand:self:2"]')!;

    expect(tile).not.toBeNull();
    if (!tile) return;
    expect(tile.dataset.cardId).toBeUndefined();
    expect(tile.getAttribute('aria-label')).not.toContain('PUBLIC-CARD');
    expect(tile.getAttribute('aria-label')).not.toContain('Known Card');
    const back = container.querySelector<HTMLImageElement>('img.card-art');
    expect(back).not.toBeNull();
    expect(back?.classList.contains('selectable-card-tile__back-art')).toBe(true);
    expect(back?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(back?.getAttribute('src')).not.toContain('PUBLIC-CARD');
    expect(back?.getAttribute('src')).not.toContain('Known%20Card');
    expect(back?.getAttribute('alt')).toBe('');
    expect(tile.getAttribute('aria-label')).toBe('Set card 2 を選択');
    expect(container.querySelector('[data-testid="selectable-card-tile-detail"]')).toBeNull();
    expect(container.textContent).not.toContain('PUBLIC-CARD');
    expect(container.textContent).not.toContain('Known Card');
    expect(container.innerHTML).not.toContain('PUBLIC-CARD');
    expect(container.innerHTML).not.toContain('Known Card');
    act(() => tile.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    expect(onExpand).not.toHaveBeenCalled();
    act(() => tile.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onSelect).toHaveBeenCalledWith('hand:self:2');
    unmount(root);
  });

  it('gives duplicate hidden physical cards distinct accessible names while preserving keyboard-selectable instance ids', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onSelect = vi.fn();

    act(() => {
      root.render(
        <>
          <SelectableCardTile cardId="PRIVATE-ONE" instanceId="set:self:1" hidden hiddenLabel="Set card 1" onSelect={onSelect} />
          <SelectableCardTile cardId="PRIVATE-TWO" instanceId="set:self:2" hidden hiddenLabel="Set card 2" onSelect={onSelect} />
        </>,
      );
    });

    const hiddenTiles = [...container.querySelectorAll<HTMLButtonElement>('.selectable-card-tile__select')];
    expect(hiddenTiles.map((tile) => tile.getAttribute('aria-label'))).toEqual(['Set card 1 を選択', 'Set card 2 を選択']);
    expect(hiddenTiles.map((tile) => tile.dataset.instanceId)).toEqual(['set:self:1', 'set:self:2']);
    expect(hiddenTiles.every((tile) => tile.type === 'button' && tile.tabIndex === 0)).toBe(true);
    expect(container.innerHTML).not.toContain('PRIVATE-ONE');
    expect(container.innerHTML).not.toContain('PRIVATE-TWO');

    act(() => hiddenTiles[1]!.click());
    expect(onSelect).toHaveBeenCalledWith('set:self:2');
    unmount(root);
  });

  it('exposes an optional primary selection test id without disclosing a hidden card id', () => {
    const { container, root } = renderTile({
      cardId: 'PUBLIC-CARD',
      hidden: true,
      hiddenLabel: 'Set card 2',
      selectTestId: 'set-card-choice-2',
    });
    const tile = container.querySelector<HTMLElement>('[data-testid="set-card-choice-2"]');

    expect(tile).toBeInstanceOf(HTMLButtonElement);
    expect(tile?.textContent).toBe('Set card 2');
    expect(tile?.innerHTML).not.toContain('PUBLIC-CARD');
    expect(tile?.getAttribute('aria-label')).not.toContain('PUBLIC-CARD');
    unmount(root);
  });

  it('keeps the detail button at the mobile touch target minimum', () => {
    expect(CSS_SOURCE).toMatch(
      /\.selectable-card-tile__detail\s*\{[\s\S]*min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px;/,
    );
  });
});
