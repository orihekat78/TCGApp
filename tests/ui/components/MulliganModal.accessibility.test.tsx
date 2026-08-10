// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MulliganModal } from '@/ui/components/MulliganModal';
import { _resetMulliganStore, useMulliganStore } from '@/ui/hooks/useMulligan';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('MulliganModal accessibility', () => {
  let container: HTMLDivElement;
  let root: Root;
  let origin: HTMLButtonElement;
  let resolve: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    origin = document.createElement('button');
    origin.textContent = 'origin';
    document.body.appendChild(origin);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    resolve = vi.fn();
    origin.focus();
    act(() => {
      useMulliganStore.getState()._setResolver(resolve);
      useMulliganStore.getState()._setCurrent({ player: 'self', hand: ['D08015'] });
      root.render(<MulliganModal />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    _resetMulliganStore();
    container.remove();
    origin.remove();
  });

  it('initially focuses an enabled control, traps Tab, and resolves skip on outer Escape', () => {
    const skip = container.querySelector<HTMLButtonElement>('.mulligan-skip')!;
    const card = container.querySelector<HTMLButtonElement>('.mulligan-card-toggle')!;
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;

    expect(document.activeElement).toBe(skip);

    skip.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(card);

    card.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(skip);

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(resolve).toHaveBeenCalledWith([]);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(dialog.isConnected).toBe(false);
    expect(document.activeElement).toBe(origin);
  });

  it('contains zoom focus, closes only the nested dialog on Escape, then returns to its trigger', () => {
    const zoom = container.querySelector<HTMLButtonElement>('.mulligan-card-zoom')!;
    act(() => zoom.click());

    const zoomDialog = container.querySelector<HTMLElement>('.mulligan-zoom-overlay')!;
    const close = container.querySelector<HTMLButtonElement>('.mulligan-zoom-close')!;
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(container.querySelector('.mulligan-modal-header')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.mulligan-cards-row')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.mulligan-modal-footer')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe(close);

    close.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(close);

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(zoomDialog.isConnected).toBe(false);
    expect(document.activeElement).toBe(zoom);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('keeps the 44px detail control in a dedicated lane outside the card image button', () => {
    const card = container.querySelector<HTMLButtonElement>('.mulligan-card-toggle')!;
    const zoom = container.querySelector<HTMLButtonElement>('.mulligan-card-zoom')!;
    const actions = container.querySelector<HTMLElement>('.mulligan-card-actions');

    expect(actions).not.toBeNull();
    expect(actions?.contains(zoom)).toBe(true);
    expect(card.contains(zoom)).toBe(false);
  });
});
