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

  it('keeps backdrop and Escape close paths', () => {
    const onClose = vi.fn();
    act(() => root.render(<CardExpandModal cardId="D08015" onClose={onClose} />));

    act(() => (container.querySelector('.card-expand-modal-backdrop') as HTMLDivElement).click());
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
