import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardListModal } from '@/ui/components/CardListModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CardListModal pick detail controls', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps a public pick primary separate from its detail control', () => {
    const onPick = vi.fn();
    const onExpand = vi.fn();
    act(() => {
      root.render(
        <CardListModal
          kind="deck"
          side="self"
          cards={['D08003']}
          pickCands={[{ uid: 'D08003#0', cardId: 'D08003', player: 'self' }]}
          onPick={onPick}
          onExpand={onExpand}
          onClose={vi.fn()}
        />,
      );
    });

    const primary = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-D08003#0"]');
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-detail-D08003#0"]');
    expect(primary).not.toBeNull();
    expect(detail).not.toBeNull();
    expect(primary?.parentElement).toBe(detail?.parentElement);
    expect(primary?.querySelector('button')).toBeNull();
    expect(detail?.querySelector('button')).toBeNull();
    expect(detail?.classList.contains('card-list-pick-detail')).toBe(true);

    act(() => detail!.click());
    expect(onExpand).toHaveBeenCalledWith('D08003');
    expect(onPick).not.toHaveBeenCalled();

    act(() => primary!.click());
    expect(onPick).toHaveBeenCalledWith('D08003#0');

    act(() => primary!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    expect(onExpand).toHaveBeenCalledTimes(2);
  });

  it('never exposes a face-down evidence pick to detail expansion', () => {
    act(() => {
      root.render(
        <CardListModal
          kind="evidence"
          side="self"
          cards={[]}
          faceDownCount={1}
          pickCands={[{ uid: 'evidence:self:0', cardId: 'D08007', player: 'self' }]}
          onPick={vi.fn()}
          onExpand={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('[data-testid="card-list-pick-evidence:self:0"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="card-list-pick-detail-evidence:self:0"]')).toBeNull();
    expect(container.innerHTML).not.toContain('D08007');
  });

  it('omits detail controls when no expansion handler exists', () => {
    act(() => {
      root.render(
        <CardListModal
          kind="deck"
          side="self"
          cards={['D08003']}
          pickCands={[{ uid: 'D08003#0', cardId: 'D08003', player: 'self' }]}
          onPick={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('[data-testid="card-list-pick-detail-D08003#0"]')).toBeNull();
  });
});
