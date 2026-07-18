// Phase 8 完全クローズ Commit 4: SouzaReorderModal SSR test
//
// rules: 13-keywords.md §捜査X
// spec: 計画 — Commit 4

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SouzaReorderModal } from '@/ui/components/SouzaReorderModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const CSS_SOURCE = readFileSync(resolve(process.cwd(), 'src/ui/components/SouzaReorderModal.css'), 'utf8');
const DECK_REORDER_SOURCE = readFileSync(resolve(process.cwd(), 'src/ui/components/DeckReorderModalHost.tsx'), 'utf8');
const DECK_PLACE_SOURCE = readFileSync(resolve(process.cwd(), 'src/ui/components/DeckPlaceModalHost.tsx'), 'utf8');

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
    const onCancel = vi.fn();

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
          onCancel={onCancel}
        />,
      );
    });

    const start = container.querySelector<HTMLElement>('[data-testid="souza-row-0"]')!;
    const target = container.querySelector<HTMLElement>('[data-testid="souza-row-2"]')!;
    act(() => start.dispatchEvent(new Event('dragstart', { bubbles: true })));
    act(() => target.dispatchEvent(new Event('drop', { bubbles: true })));
    const tiles = [...container.querySelectorAll<HTMLElement>('[data-instance-id]')];
    expect(tiles).toHaveLength(3);
    expect(new Set(tiles.map((tile) => tile.dataset.instanceId)).size).toBe(3);
    expect(tiles.map((tile) => tile.dataset.instanceId))
      .toEqual(['DUPLICATE-CARD#1', 'DUPLICATE-CARD#2', 'UNKNOWN-CARD#0']);
    expect(container.querySelectorAll('.selectable-card-tile img')).toHaveLength(3);
    expect(container.querySelector<HTMLImageElement>('[data-card-id="UNKNOWN-CARD"] img')?.src)
      .toMatch(/^data:image\/svg\+xml/);
    expect(container.querySelector('button button')).toBeNull();

    const details = container.querySelectorAll<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]');
    expect(details).toHaveLength(3);
    act(() => details[1]!.click());
    expect(container.querySelector('[aria-label^="カード拡大表示:"]')).not.toBeNull();
    act(() => (container.querySelector('.card-expand-close') as HTMLButtonElement).click());

    act(() => (container.querySelector('[data-testid="souza-cancel-btn"]') as HTMLButtonElement).click());
    expect(onCancel).toHaveBeenCalledTimes(1);
    act(() => (container.querySelector('[data-testid="souza-confirm-btn"]') as HTMLButtonElement).click());
    expect(onConfirm).toHaveBeenCalledWith(['DUPLICATE-CARD', 'DUPLICATE-CARD', 'UNKNOWN-CARD']);
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

  it('keeps confirm and cancel controls at the mobile 44px target minimum', () => {
    expect(CSS_SOURCE).toMatch(
      /\.souza-btn\s*\{[\s\S]*min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px;/,
    );
  });

  it('shares a viewport-bounded, internally scrolling shell with both deck decision hosts', () => {
    expect(CSS_SOURCE).toMatch(/\.souza-modal\s*\{[\s\S]*max-height:\s*calc\(100vh - 16px\);[\s\S]*max-block-size:\s*calc\(100dvh - 16px\);[\s\S]*display:\s*flex;/);
    expect(CSS_SOURCE).toMatch(/\.souza-body\s*\{[\s\S]*flex:\s*1 1 auto;[\s\S]*min-block-size:\s*0;[\s\S]*overflow-y:\s*auto;/);
    expect(DECK_REORDER_SOURCE).toContain("import './SouzaReorderModal.css';");
    expect(DECK_PLACE_SOURCE).toContain("import './SouzaReorderModal.css';");
  });
});
