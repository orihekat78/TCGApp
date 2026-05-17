// Phase 8 完全クローズ Commit 4: SouzaReorderModal SSR test
//
// rules: 13-keywords.md §捜査X
// spec: 計画 — Commit 4

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SouzaReorderModal } from '@/ui/components/SouzaReorderModal';

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
});
