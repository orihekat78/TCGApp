// Phase 8 完全クローズ Commit 4: SouzaReorderModal SSR test
//
// rules: 13-keywords.md §捜査X
// spec: 計画 — Commit 4

import { act, useState } from 'react';
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
    const duplicateTiles = tiles.filter((tile) => tile.dataset.cardId === 'DUPLICATE-CARD');
    const duplicateDetails = [...container.querySelectorAll<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]')]
      .filter((detail) => detail.parentElement?.querySelector('[data-card-id="DUPLICATE-CARD"]'));
    expect(duplicateTiles.map((tile) => tile.getAttribute('aria-label'))).toEqual(['DUPLICATE-CARD 1枚目を選択', 'DUPLICATE-CARD 2枚目を選択']);
    expect(duplicateDetails.map((detail) => detail.getAttribute('aria-label'))).toEqual(['DUPLICATE-CARD 1枚目の詳細を表示', 'DUPLICATE-CARD 2枚目の詳細を表示']);
    expect([...duplicateTiles, ...duplicateDetails].map((element) => element.getAttribute('aria-label')).join(' ')).not.toContain('DUPLICATE-CARD#');

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

  it('keeps every long Souza decision control and the exact occurrence order after details close', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const deckTop = [
      { cardId: 'D08003', name: 'A' }, { cardId: 'D08007', name: 'B' },
      { cardId: 'D08013', name: 'C' }, { cardId: 'D08001', name: 'D' },
      { cardId: 'D08003', name: 'A' }, { cardId: 'D08007', name: 'B' },
      { cardId: 'D08013', name: 'C' }, { cardId: 'D08001', name: 'D' },
    ];
    const expected = ['D08007#1', 'D08003#0', 'D08013#2', 'D08001#3', 'D08003#4', 'D08007#5', 'D08001#7', 'D08013#6'];

    function DecisionHarness() {
      const [open, setOpen] = useState(true);
      return (
        <SouzaReorderModal
          open={open}
          deckTop={deckTop}
          onCancel={() => { onCancel(); setOpen(false); }}
          onConfirm={(ids) => { onConfirm(ids); setOpen(false); }}
        />
      );
    }

    const exerciseLongDecision = (): void => {
      expect(container.querySelectorAll('[data-instance-id]')).toHaveLength(8);
      act(() => (container.querySelector('[data-testid="souza-down-0"]') as HTMLButtonElement).click());
      const firstDetail = container.querySelector<HTMLElement>('[data-testid="souza-row-0"] [data-testid="selectable-card-tile-detail"]')!;
      act(() => firstDetail.click());
      act(() => (container.querySelector('.card-expand-close') as HTMLButtonElement).click());
      act(() => (container.querySelector('[data-testid="souza-up-7"]') as HTMLButtonElement).click());
      const finalDetail = container.querySelector<HTMLElement>('[data-testid="souza-row-7"] [data-testid="selectable-card-tile-detail"]')!;
      act(() => finalDetail.click());
      act(() => (container.querySelector('.card-expand-close') as HTMLButtonElement).click());
      expect([...container.querySelectorAll<HTMLElement>('[data-instance-id]')].map((tile) => tile.dataset.instanceId))
        .toEqual(expected);
      expect(container.querySelector('[data-testid="souza-up-7"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="souza-confirm-btn"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="souza-cancel-btn"]')).not.toBeNull();
    };

    let root: Root = createRoot(container);
    act(() => root.render(<DecisionHarness />));
    exerciseLongDecision();
    act(() => (container.querySelector('[data-testid="souza-cancel-btn"]') as HTMLButtonElement).click());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="souza-modal"]')).toBeNull();
    act(() => root.unmount());

    root = createRoot(container);
    act(() => root.render(<DecisionHarness />));
    exerciseLongDecision();
    act(() => (container.querySelector('[data-testid="souza-confirm-btn"]') as HTMLButtonElement).click());
    expect(onConfirm).toHaveBeenCalledWith(['D08007', 'D08003', 'D08013', 'D08001', 'D08003', 'D08007', 'D08001', 'D08013']);
    expect(container.querySelector('[data-testid="souza-modal"]')).toBeNull();
    act(() => root.unmount());
    container.remove();
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

  it('uses the 851x393 landscape-safe, internally scrolling shared shell for all deck decisions', () => {
    expect(CSS_SOURCE).toMatch(/\.souza-modal\s*\{[\s\S]*max-height:\s*calc\(100vh - 16px\);[\s\S]*max-block-size:\s*calc\(100dvh - 16px\);[\s\S]*display:\s*flex;/);
    expect(CSS_SOURCE).toMatch(/\.souza-body\s*\{[\s\S]*flex:\s*1 1 auto;[\s\S]*min-block-size:\s*0;[\s\S]*overflow-y:\s*auto;/);
    expect(CSS_SOURCE).toMatch(/\.souza-arrow\s*\{[\s\S]*min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px;/);
    expect(DECK_REORDER_SOURCE).toContain("import './SouzaReorderModal.css';");
    expect(DECK_PLACE_SOURCE).toContain("import './SouzaReorderModal.css';");
  });
});
