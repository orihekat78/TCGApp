import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HiramekiDemoPickerModal } from '@/ui/components/HiramekiDemoPickerModal';
import { CutinDemoPickerModal } from '@/ui/components/CutinDemoPickerModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type DemoModal = typeof HiramekiDemoPickerModal | typeof CutinDemoPickerModal;

describe.each([
  ['hirameki', HiramekiDemoPickerModal, 'hirameki-demo-pick-', 'hirameki-demo-detail-'],
  ['cutin', CutinDemoPickerModal, 'cutin-demo-pick-', 'cutin-demo-detail-'],
] as const)('%s demo picker card details', (_kind, Modal, primaryPrefix, detailPrefix) => {
  let root: Root;
  let container: HTMLDivElement;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('opens public card detail without selecting the demo', () => {
    const onPick = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Modal onPick={onPick} onClose={vi.fn()} />));

    const primary = container.querySelector<HTMLButtonElement>(`[data-testid^="${primaryPrefix}"]`);
    const detail = container.querySelector<HTMLButtonElement>(`[data-testid^="${detailPrefix}"]`);
    expect(primary).toBeInstanceOf(HTMLButtonElement);
    expect(detail).toBeInstanceOf(HTMLButtonElement);
    expect(detail!.getAttribute('aria-label')).toMatch(/^.+の詳細を表示$/);
    expect(primary?.querySelector('img.card-art')).not.toBeNull();
    expect(primary?.querySelector('button')).toBeNull();

    act(() => detail!.click());
    expect(container.querySelector('.card-expand-close')).not.toBeNull();
    expect(onPick).not.toHaveBeenCalled();
    act(() => (container.querySelector<HTMLButtonElement>('.card-expand-close')!).click());

    const context = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => primary!.dispatchEvent(context));
    expect(context.defaultPrevented).toBe(true);
    expect(container.querySelector('.card-expand-close')).not.toBeNull();
  });
});
