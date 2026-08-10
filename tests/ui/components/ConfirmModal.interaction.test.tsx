// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import type { ResolvedConfirmRequest } from '@/ui/hooks/useConfirmation';

const request: ResolvedConfirmRequest = {
  kind: 'standard',
  title: '確認',
  body: 'この操作を実行しますか。',
  okLabel: '実行',
  cancelLabel: 'キャンセル',
};

describe('ConfirmModal keyboard interaction', () => {
  let container: HTMLDivElement;
  let root: Root;
  let origin: HTMLButtonElement;

  beforeEach(() => {
    origin = document.createElement('button');
    origin.textContent = '起点';
    document.body.appendChild(origin);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    origin.focus();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    origin.remove();
  });

  it('focuses the primary action and rejects with Escape', () => {
    const reject = vi.fn();
    act(() => root.render(
      <ConfirmModal current={request} onAccept={vi.fn()} onReject={reject} />,
    ));

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const accept = container.querySelector<HTMLButtonElement>('.confirm-ok')!;
    expect(document.activeElement).toBe(accept);

    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })));
    expect(reject).toHaveBeenCalledOnce();
  });

  it('keeps Tab focus inside the two modal actions', () => {
    act(() => root.render(
      <ConfirmModal current={request} onAccept={vi.fn()} onReject={vi.fn()} />,
    ));

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const cancel = container.querySelector<HTMLButtonElement>('.confirm-cancel')!;
    const accept = container.querySelector<HTMLButtonElement>('.confirm-ok')!;

    accept.focus();
    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })));
    expect(document.activeElement).toBe(cancel);

    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })));
    expect(document.activeElement).toBe(accept);
  });

  it('returns focus to the action that opened the modal', () => {
    act(() => root.render(
      <ConfirmModal current={request} onAccept={vi.fn()} onReject={vi.fn()} />,
    ));
    act(() => root.render(
      <ConfirmModal current={null} onAccept={vi.fn()} onReject={vi.fn()} />,
    ));

    expect(document.activeElement).toBe(origin);
  });
});
