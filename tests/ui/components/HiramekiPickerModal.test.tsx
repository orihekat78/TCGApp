// Phase 8 完全クローズ Commit 3a: HiramekiPickerModal SSR test
//
// rules: 10-action-event.md §ヒラメキ
// spec: 計画 — Commit 3a

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HiramekiPickerModal } from '@/ui/components/HiramekiPickerModal';

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
