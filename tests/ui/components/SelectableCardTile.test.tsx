import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { SelectableCardTile } from '@/ui/components/SelectableCardTile';

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
    expect(container.querySelectorAll('[data-card-id="B01001"]')).toHaveLength(2);
    expect(second).not.toBeNull();
    if (!second) return;
    act(() => second!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onSelect).toHaveBeenCalledWith('hand:self:2');
    unmount(root);
  });

  it('keeps primary selection separate from the detail control', () => {
    const { container, root, onSelect, onExpand } = renderTile();
    const tile = container.querySelector<HTMLElement>('[data-instance-id="hand:self:2"]')!;
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]')!;

    expect(container.querySelector('button button')).toBeNull();
    expect(tile).not.toBeNull();
    expect(detail).not.toBeNull();
    if (!tile || !detail) return;
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

  it('does not disclose or expand a hidden card while keeping it selectable', () => {
    const { container, root, onSelect, onExpand } = renderTile({ hidden: true });
    const tile = container.querySelector<HTMLElement>('[data-instance-id="hand:self:2"]')!;

    expect(tile).not.toBeNull();
    if (!tile) return;
    expect(tile.dataset.cardId).toBeUndefined();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-testid="selectable-card-tile-detail"]')).toBeNull();
    act(() => tile.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    expect(onExpand).not.toHaveBeenCalled();
    act(() => tile.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onSelect).toHaveBeenCalledWith('hand:self:2');
    unmount(root);
  });
});
