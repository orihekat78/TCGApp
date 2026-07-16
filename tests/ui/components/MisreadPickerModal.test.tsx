// Phase 8 完全クローズ Commit 3b: MisreadPickerModal SSR test
//
// rules: 13-keywords.md §ミスリード
// spec: 計画 — Commit 3b

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MisreadPickerModal } from '@/ui/components/MisreadPickerModal';

describe('MisreadPickerModal', () => {
  it('open=false → 何も描画しない', () => {
    const html = renderToString(
      <MisreadPickerModal
        open={false}
        decisionKey="closed"
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
        decisionKey="decision-1"
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

  it('閉じて再表示した時と次のpendingに切り替わった時に選択をリセットする', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    const root = createRoot(container);
    const render = (open: boolean, reasoningName: string): void => {
      act(() => root.render(
        <MisreadPickerModal
          open={open}
          decisionKey={reasoningName}
          reasoningName={reasoningName}
          reasoningLp={3}
          candidates={[{ uid: 'm1', cardName: 'M1', x: 1 }]}
          onConfirm={() => {}}
          onSkip={() => {}}
        />,
      ));
    };

    render(true, 'reasoner-a');
    const checkbox = (): HTMLInputElement => container.querySelector('[data-testid="misread-cand-m1"]')!;
    act(() => checkbox().dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(checkbox().checked).toBe(true);

    render(false, 'reasoner-a');
    render(true, 'reasoner-a');
    expect(checkbox().checked).toBe(false);

    act(() => checkbox().dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(checkbox().checked).toBe(true);
    render(true, 'reasoner-b');
    expect(checkbox().checked).toBe(false);

    act(() => root.unmount());
  });
});
