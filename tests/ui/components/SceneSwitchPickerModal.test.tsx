// Phase 8 完全クローズ Commit 4: SceneSwitchPickerModal SSR test
//
// rules: 20-color-and-switch.md §スイッチ
// spec: 計画 — Commit 4

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SceneSwitchPickerModal } from '@/ui/components/SceneSwitchPickerModal';

describe('SceneSwitchPickerModal', () => {
  it('open=false → 何も描画しない', () => {
    const html = renderToString(
      <SceneSwitchPickerModal
        open={false}
        sceneChars={[]}
        newCardName=""
        onPick={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('open=true → スイッチヘッダ + scene 一覧 + 各キャラのボタン', () => {
    const html = renderToString(
      <SceneSwitchPickerModal
        open={true}
        newCardName="新キャラ"
        sceneChars={[
          { uid: 'c1', cardId: 'X1', name: 'コナン', state: 'active', isNamed: false },
          { uid: 'c2', cardId: 'X2', name: '蘭', state: 'sleep', isNamed: true },
        ]}
        onPick={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toMatch(/スイッチ/);
    expect(html).toMatch(/新キャラ/);
    expect(html).toMatch(/コナン/);
    expect(html).toMatch(/蘭/);
    expect(html).toMatch(/\[active\]/);
    expect(html).toMatch(/\[sleep\/名乗り\]/);
    expect(html).toMatch(/data-testid="ssp-cand-c1"/);
    expect(html).toMatch(/data-testid="ssp-cand-c2"/);
  });
});
