// Phase 8 完全クローズ Commit 3b: MisreadPickerModal SSR test
//
// rules: 13-keywords.md §ミスリード
// spec: 計画 — Commit 3b

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MisreadPickerModal } from '@/ui/components/MisreadPickerModal';

describe('MisreadPickerModal', () => {
  it('open=false → 何も描画しない', () => {
    const html = renderToString(
      <MisreadPickerModal
        open={false}
        reasoningName="毛利蘭"
        reasoningLp={5000}
        candidates={[]}
        onConfirm={() => {}}
        onSkip={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('open=true → ヒラメキ ヘッダ + 推理側名 + 候補一覧 + 2 ボタン', () => {
    const html = renderToString(
      <MisreadPickerModal
        open={true}
        reasoningName="毛利蘭"
        reasoningLp={5000}
        candidates={[
          { uid: 'm1', cardName: '怪盗キッド', x: 2000 },
          { uid: 'm2', cardName: '黒の組織', x: 1000 },
        ]}
        onConfirm={() => {}}
        onSkip={() => {}}
      />,
    );
    expect(html).toMatch(/ミスリード!/);
    expect(html).toMatch(/毛利蘭/);
    expect(html).toMatch(/怪盗キッド/);
    expect(html).toMatch(/黒の組織/);
    expect(html).toMatch(/LP -2000/);
    expect(html).toMatch(/LP -1000/);
    expect(html).toMatch(/data-testid="misread-confirm-btn"/);
    expect(html).toMatch(/data-testid="misread-skip-btn"/);
  });
});
