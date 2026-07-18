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
    const { container, root, onSelect, onExpand } = renderTile({ cardId: 'PUBLIC-CARD', hidden: true });
    const tile = container.querySelector<HTMLElement>('[data-instance-id="hand:self:2"]')!;

    expect(tile).not.toBeNull();
    if (!tile) return;
    expect(tile.dataset.cardId).toBeUndefined();
    expect(tile.getAttribute('aria-label')).not.toContain('PUBLIC-CARD');
    expect(tile.getAttribute('aria-label')).not.toContain('Known Card');
    expect(container.querySelector('img')).toBeNull();
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

  it('keeps the detail button at the mobile touch target minimum', () => {
    expect(CSS_SOURCE).toMatch(
      /\.selectable-card-tile__detail\s*\{[\s\S]*min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px;/,
    );
  });
});
