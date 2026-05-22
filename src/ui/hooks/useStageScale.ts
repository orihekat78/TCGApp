// Cleanup Phase #6 (user_request 20260521_01 関連): Playmat のレスポンシブ対応
//
// 設計仕様 (Phase 7.3 Task): `.stage` は固定 1920×1080 で実装、`.scaler` で
// transform: scale() を適用してビューポートに合わせる方針。本 hook が
// 動的にスケール値を計算する。
//
// スケール計算: `min(vw/1920, vh/1080, 1)` — 縮小のみ、拡大しない (1.0 上限)
// resize / orientationchange イベントで再計算

import { useEffect, useState } from 'react';

const DESIGN_W = 1920;
const DESIGN_H = 1080;

function computeScale(): number {
  if (typeof window === 'undefined') return 1;
  const sx = window.innerWidth / DESIGN_W;
  const sy = window.innerHeight / DESIGN_H;
  return Math.min(sx, sy, 1);
}

/**
 * stage 用スケール値を返す hook。
 * ビューポート変化時に自動再計算。
 */
export function useStageScale(): number {
  const [scale, setScale] = useState<number>(() => computeScale());

  useEffect(() => {
    const update = (): void => setScale(computeScale());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return scale;
}
