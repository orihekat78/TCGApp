// Phase 8 完全クローズ Commit 3a: HiramekiPickerModal SSR test
//
// rules: 10-action-event.md §ヒラメキ
// spec: 計画 — Commit 3a

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HiramekiPickerModal } from '@/ui/components/HiramekiPickerModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('HiramekiPickerModal', () => {
  it('open=false → 何も描画しない (null 返却 → 空文字列)', () => {
    const html = renderToString(
      <HiramekiPickerModal
        open={false}
        cardName="阿笠博士"
        abilityText="カードを1枚引く"
        onFire={() => {}}
        onSkip={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('open=true → ヒラメキ! ヘッダ + cardName + abilityText + 2 ボタン描画', () => {
    const html = renderToString(
      <HiramekiPickerModal
        open={true}
        cardName="阿笠博士"
        abilityText="カードを1枚引く"
        onFire={() => {}}
        onSkip={() => {}}
      />,
    );
    expect(html).toMatch(/ヒラメキ!/);
    expect(html).toMatch(/阿笠博士/);
    expect(html).toMatch(/カードを1枚引く/);
    expect(html).toMatch(/data-testid="hirameki-fire-btn"/);
    expect(html).toMatch(/data-testid="hirameki-skip-btn"/);
    expect(html).toMatch(/発動する/);
    expect(html).toMatch(/スキップ/);
  });
});

describe('HiramekiPickerModal source-card details', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) act(() => root!.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  it('opens its known triggering card from a sibling detail control without firing or skipping', () => {
    const onFire = vi.fn();
    const onSkip = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(
      <HiramekiPickerModal
        open
        cardId="D08015"
        cardName="阿笠博士"
        abilityText="カードを1枚引く"
        onFire={onFire}
        onSkip={onSkip}
      />,
    ));

    const source = container.querySelector<HTMLButtonElement>('[data-testid="hirameki-source-card"]');
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="hirameki-source-card-detail"]');
    expect(source).toBeInstanceOf(HTMLButtonElement);
    expect(detail).toBeInstanceOf(HTMLButtonElement);
    expect(source?.querySelector('img.card-art')).not.toBeNull();
    expect(source?.querySelector('button')).toBeNull();
    act(() => detail!.click());
    expect(container.querySelector('.card-expand-close')).not.toBeNull();
    expect(onFire).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();

    act(() => (container.querySelector<HTMLButtonElement>('.card-expand-close')!).click());
    const context = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => source!.dispatchEvent(context));
    expect(context.defaultPrevented).toBe(true);
    expect(container.querySelector('.card-expand-close')).not.toBeNull();
  });
});
