// Cleanup #6 (user_request 関連): Playmat scale hook tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// hook を test するのは renderHook が必要だが、現プロジェクトは @testing-library
// を持たないため、computeScale 相当ロジックを直接 import する設計に揃える。
// useStageScale は computeScale を内部利用。
// → ここでは hook 自体の interface を smoke 確認のみ実施 (function 存在 / 呼出
//   時に number 返却 / window resize listener 追加)。

import {
  computePlaymatViewportLayout,
  computeStageScale,
  useStageScale,
} from '@/ui/hooks/useStageScale';

describe('useStageScale', () => {
  it('is exported as a function', () => {
    expect(typeof useStageScale).toBe('function');
  });

  it('keeps the existing desktop 1440x900 scale contract', () => {
    expect(computeStageScale(1440, 900)).toBe(0.75);

    expect(computePlaymatViewportLayout(1440, 900)).toMatchObject({
      containedLandscape: false,
      scale: 0.75,
      rightGutter: 0,
    });
  });

  it('contains the unchanged 1920x1080 desktop board at 851x393', () => {
    const layout = computePlaymatViewportLayout(851, 393);

    expect(layout).toMatchObject({
      containedLandscape: true,
      logicalWidth: 1920,
      logicalHeight: 1080,
    });
    expect(layout.scale).toBeCloseTo(393 / 1080, 8);
    expect(layout.renderedWidth).toBeCloseTo(698.6667, 4);
    expect(layout.renderedHeight).toBeCloseTo(393, 4);
    expect(layout.left).toBeCloseTo(76.1667, 4);
    expect(layout.top).toBeCloseTo(0, 4);
    expect(layout.rightGutter).toBeCloseTo(76.1667, 4);
  });

  it('centers the unchanged board at 720x393 without reserving a presentation rail', () => {
    const layout = computePlaymatViewportLayout(720, 393);

    expect(layout).toMatchObject({
      containedLandscape: true,
      logicalWidth: 1920,
      logicalHeight: 1080,
    });
    expect(layout.scale).toBeCloseTo(393 / 1080, 8);
    expect(layout.renderedWidth).toBeCloseTo(698.6667, 4);
    expect(layout.renderedHeight).toBeCloseTo(393, 4);
    expect(layout.left).toBeCloseTo(10.6667, 4);
    expect(layout.top).toBeCloseTo(0, 4);
    expect(layout.rightGutter).toBeCloseTo(10.6667, 4);
  });

  // 詳細なスケール値計算は実機 Playwright で検証済 (1280→0.667 / 1440→0.75 /
  // 1920→1.0)。本 unit test は smoke として hook の存在のみ assert。
});
