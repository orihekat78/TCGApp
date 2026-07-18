// Phase 8 完全クローズ Commit 4: SouzaReorderModal SSR test
//
// rules: 13-keywords.md §捜査X
// spec: 計画 — Commit 4

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SouzaReorderModal } from '@/ui/components/SouzaReorderModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SouzaReorderModal', () => {
  it('open=false → 何も描画しない', () => {
    const html = renderToString(
      <SouzaReorderModal
        open={false}
        deckTop={[]}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('open=true → 捜査ヘッダ + 公開カード一覧 + ▲▼ + 確定/キャンセル', () => {
    const html = renderToString(
      <SouzaReorderModal
        open={true}
        deckTop={[
          { cardId: 'X1', name: 'カード A' },
          { cardId: 'X2', name: 'カード B' },
          { cardId: 'X3', name: 'カード C' },
        ]}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toMatch(/捜査/);
    expect(html).toMatch(/3 枚/);
    expect(html).toMatch(/カード A/);
    expect(html).toMatch(/カード B/);
    expect(html).toMatch(/カード C/);
    expect(html).toMatch(/data-testid="souza-up-0"/);
    expect(html).toMatch(/data-testid="souza-down-0"/);
    expect(html).toMatch(/data-testid="souza-confirm-btn"/);
    expect(html).toMatch(/data-testid="souza-cancel-btn"/);
  });

  it('keeps reordered duplicate occurrences after card details close and confirms that order', () => {
    const container = document.createElement('div');
    const root: Root = createRoot(container);
    const onConfirm = vi.fn();

    act(() => {
      root.render(
        <SouzaReorderModal
          open
          deckTop={[
            { cardId: 'UNKNOWN-CARD', name: 'Unknown' },
            { cardId: 'DUPLICATE-CARD', name: 'Duplicate' },
            { cardId: 'DUPLICATE-CARD', name: 'Duplicate' },
          ]}
          onConfirm={onConfirm}
          onCancel={() => {}}
        />,
      );
    });

    act(() => (container.querySelector('[data-testid="souza-down-0"]') as HTMLButtonElement).click());
    const tiles = [...container.querySelectorAll<HTMLElement>('[data-instance-id]')];
    expect(tiles).toHaveLength(3);
    expect(new Set(tiles.map((tile) => tile.dataset.instanceId)).size).toBe(3);
    expect(container.querySelectorAll('.selectable-card-tile img')).toHaveLength(3);
    expect(container.querySelector<HTMLImageElement>('[data-card-id="UNKNOWN-CARD"] img')?.src)
      .toMatch(/^data:image\/svg\+xml/);
    expect(container.querySelector('button button')).toBeNull();

    const details = container.querySelectorAll<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]');
    expect(details).toHaveLength(3);
    act(() => details[1]!.click());
    expect(container.querySelector('[aria-label^="カード拡大表示:"]')).not.toBeNull();
    act(() => (container.querySelector('.card-expand-close') as HTMLButtonElement).click());

    expect(container.querySelector('[data-testid="souza-row-0"]')?.textContent).toContain('DUPLICATE-CARD');
    act(() => (container.querySelector('[data-testid="souza-confirm-btn"]') as HTMLButtonElement).click());
    expect(onConfirm).toHaveBeenCalledWith(['DUPLICATE-CARD', 'UNKNOWN-CARD', 'DUPLICATE-CARD']);
    act(() => root.unmount());
  });

  it('renders an explicit empty state without card tiles', () => {
    const html = renderToString(
      <SouzaReorderModal
        open
        deckTop={[]}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('公開カードがありません');
    expect(html).not.toContain('selectable-card-tile');
  });
});
