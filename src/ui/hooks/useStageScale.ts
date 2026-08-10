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

import { useEffect, useState, type RefObject } from 'react';

export const PLAYMAT_DESIGN_WIDTH = 1920;
export const PLAYMAT_DESIGN_HEIGHT = 1080;
const MIN_SCALE = 0.2; // 下限: 極小ウィンドウでの sanity bound (実質到達しない)
const MAX_SCALE = 1.6; // soft-cap: 大画面でのカード画像 (CDN ラスター) ボケ回避

export type PlaymatViewportLayout = {
  containedLandscape: boolean;
  scale: number;
  logicalWidth: number;
  logicalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  left: number;
  top: number;
  rightGutter: number;
};

export function computeStageScale(width: number, height: number): number {
  const sx = width / PLAYMAT_DESIGN_WIDTH;
  const sy = height / PLAYMAT_DESIGN_HEIGHT;
  const raw = Math.min(sx, sy);
  return Math.max(MIN_SCALE, Math.min(raw, MAX_SCALE));
}

export function computePlaymatViewportLayout(
  width: number,
  height: number,
): PlaymatViewportLayout {
  const containedLandscape = width <= 900 && height <= 520 && width > height;
  if (!containedLandscape) {
    const scale = computeStageScale(width, height);
    return {
      containedLandscape: false,
      scale,
      logicalWidth: PLAYMAT_DESIGN_WIDTH,
      logicalHeight: PLAYMAT_DESIGN_HEIGHT,
      renderedWidth: width,
      renderedHeight: height,
      left: 0,
      top: 0,
      rightGutter: 0,
    };
  }

  const scale = Math.min(
    width / PLAYMAT_DESIGN_WIDTH,
    height / PLAYMAT_DESIGN_HEIGHT,
  );
  const renderedWidth = PLAYMAT_DESIGN_WIDTH * scale;
  const renderedHeight = PLAYMAT_DESIGN_HEIGHT * scale;
  const left = (width - renderedWidth) / 2;

  return {
    containedLandscape: true,
    scale,
    logicalWidth: PLAYMAT_DESIGN_WIDTH,
    logicalHeight: PLAYMAT_DESIGN_HEIGHT,
    renderedWidth,
    renderedHeight,
    left,
    top: (height - renderedHeight) / 2,
    rightGutter: left,
  };
}

function currentStageScale(): number {
  if (typeof window === 'undefined') return 1;
  return computeStageScale(window.innerWidth, window.innerHeight);
}

type PlaymatViewportOptions = {
  containerRef?: RefObject<HTMLElement | null>;
};

function currentPlaymatViewportLayout(options?: PlaymatViewportOptions): PlaymatViewportLayout {
  if (typeof window === 'undefined') return computePlaymatViewportLayout(1920, 1080);
  const bounds = options?.containerRef?.current?.getBoundingClientRect();
  const width = bounds && bounds.width > 0 ? bounds.width : window.innerWidth;
  const height = bounds && bounds.height > 0 ? bounds.height : window.innerHeight;
  return computePlaymatViewportLayout(width, height);
}

/**
 * stage 用スケール値を返す hook。
 * ビューポート変化時に自動再計算。
 */
export function useStageScale(): number {
  const [scale, setScale] = useState<number>(() => currentStageScale());

  useEffect(() => {
    const update = (): void => setScale(currentStageScale());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return scale;
}

export function usePlaymatViewportLayout(options?: PlaymatViewportOptions): PlaymatViewportLayout {
  const [layout, setLayout] = useState<PlaymatViewportLayout>(() => currentPlaymatViewportLayout(options));
  const containerRef = options?.containerRef;

  useEffect(() => {
    const update = (): void => setLayout(currentPlaymatViewportLayout({ containerRef }));
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const observer = typeof ResizeObserver === 'undefined' || !containerRef?.current
      ? null
      : new ResizeObserver(update);
    if (observer && containerRef?.current) observer.observe(containerRef.current);
    update();
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      observer?.disconnect();
    };
  }, [containerRef]);

  return layout;
}
