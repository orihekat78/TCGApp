import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardExpandModal } from '@/ui/components/CardExpandModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CardExpandModal close controls', () => {
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

  it('delivers the normal close-button click to the detail modal', () => {
    const onClose = vi.fn();
    act(() => root.render(<CardExpandModal cardId="D08015" onClose={onClose} />));

    act(() => (container.querySelector('.card-expand-close') as HTMLButtonElement).click());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('escapes an ancestor modal stacking context into the React root', () => {
    act(() => root.render(
      <div className="cp-overlay">
        <CardExpandModal cardId="D08015" onClose={vi.fn()} />
      </div>,
    ));

    const detail = container.querySelector('.card-expand-modal-backdrop');
    expect(detail).not.toBeNull();
    expect(detail?.parentElement).toBe(container);
    expect(detail?.closest('.cp-overlay')).toBeNull();
  });

  it('keeps backdrop and Escape close paths', () => {
    const onClose = vi.fn();
    act(() => root.render(<CardExpandModal cardId="D08015" onClose={onClose} />));

    act(() => (container.querySelector('.card-expand-modal-backdrop') as HTMLDivElement).click());
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not steal focus back after the user moves to another control while closing', async () => {
    act(() => root.render(
      <>
        <button type="button" data-testid="detail-trigger">Details</button>
        <button type="button" data-testid="next-action">Next</button>
      </>,
    ));
    const trigger = container.querySelector('[data-testid="detail-trigger"]') as HTMLButtonElement;
    trigger.focus();

    act(() => root.render(
      <>
        <button type="button" data-testid="detail-trigger">Details</button>
        <button type="button" data-testid="next-action">Next</button>
        <CardExpandModal cardId="D08015" onClose={vi.fn()} />
      </>,
    ));
    await act(async () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));

    act(() => root.render(
      <>
        <button type="button" data-testid="detail-trigger">Details</button>
        <button type="button" data-testid="next-action">Next</button>
      </>,
    ));
    const next = container.querySelector('[data-testid="next-action"]') as HTMLButtonElement;
    next.focus();
    await act(async () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));

    expect(document.activeElement).toBe(next);
  });
});
