// Cleanup Phase #6 (user_request 20260521_01 関連): Playmat のレスポンシブ対応
//
// 設計仕様 (Phase 7.3 Task): `.stage` は固定 1920×1080 で実装、`.scaler` で
// transform: scale() を適用してビューポートに合わせる方針。本 hook が
// 動的にスケール値を計算する。
//
// スケール計算 (BUG-150 フルード化で改定): `min(vw/1920, vh/1080)` を [MIN, MAX] にクランプ。
//   旧: `min(…, 1)` の 1.0 上限 + transform:scale(contain) → 大画面で盤面が小さく白レターボックス。
//   新: この値を .board-content の zoom として使い、width/height=100/scale% で stage を viewport
//       全面に充填する (Playmat.tsx)。拡大も許容 (上限 MAX=1.6 はカード画像のボケ回避の soft-cap)。
// resize / orientationchange イベントで再計算

import { useEffect, useState } from 'react';

const DESIGN_W = 1920;
const DESIGN_H = 1080;
const MIN_SCALE = 0.2; // 下限: 極小ウィンドウでの sanity bound (実質到達しない)
const MAX_SCALE = 1.6; // soft-cap: 大画面でのカード画像 (CDN ラスター) ボケ回避

function computeScale(): number {
  if (typeof window === 'undefined') return 1;
  const sx = window.innerWidth / DESIGN_W;
  const sy = window.innerHeight / DESIGN_H;
  const raw = Math.min(sx, sy);
  return Math.max(MIN_SCALE, Math.min(raw, MAX_SCALE));
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
