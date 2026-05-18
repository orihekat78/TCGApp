// Round 3c-A: TutorialHighlight
// 指定 selector の DOM 要素を border + outer glow pulse でハイライトし、
// 矢印 (▼/▲/◀/▶) を配置方向に応じて配置する装飾 component。
//
// 仕様: .claude/research/tutorial/03-visual-conventions.md (矢印・吹き出し規定の MVP 実装)
// 設計: TutorialStep.target (selector + placement) から描画。
//       target rect が取得できないとき null return (graceful fallback)。

import { useEffect, useState, type JSX, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { TutorialTarget } from '@/ui/services/tutorialSteps.js';
import './TutorialHighlight.css';

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const ARROW_CHAR: Record<NonNullable<TutorialTarget['placement']>, string> = {
  top: '▼',     // target の上側、下向き矢印 (target を指す)
  bottom: '▲',  // target の下側、上向き矢印
  left: '▶',    // target の左側、右向き矢印
  right: '◀',   // target の右側、左向き矢印
};

const ARROW_OFFSET = 8;   // target との余白 (px)
const ARROW_SIZE = 32;    // 矢印 font-size (px) ≒ 視覚 box

export function TutorialHighlight({ target }: { target: TutorialTarget }): JSX.Element | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const recompute = (): void => {
      const el = document.querySelector(target.selector);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) { setRect(null); return; }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    recompute();

    // window resize / scroll で再計算
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);

    // target 要素のサイズ / 位置変化を ResizeObserver で追従
    let ro: ResizeObserver | null = null;
    const el = document.querySelector(target.selector);
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(recompute);
      ro.observe(el);
    }

    return (): void => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
      ro?.disconnect();
    };
  }, [target.selector]);

  if (!rect) return null;

  const placement = target.placement ?? 'top';

  // highlight: target rect そのものを border + glow で囲む
  const highlightStyle: CSSProperties = {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };

  // arrow 位置: placement に応じて target rect の外側に配置
  let arrowStyle: CSSProperties;
  switch (placement) {
    case 'top':
      arrowStyle = {
        top: `${rect.top - ARROW_SIZE - ARROW_OFFSET}px`,
        left: `${rect.left + rect.width / 2 - ARROW_SIZE / 2}px`,
      };
      break;
    case 'bottom':
      arrowStyle = {
        top: `${rect.top + rect.height + ARROW_OFFSET}px`,
        left: `${rect.left + rect.width / 2 - ARROW_SIZE / 2}px`,
      };
      break;
    case 'left':
      arrowStyle = {
        top: `${rect.top + rect.height / 2 - ARROW_SIZE / 2}px`,
        left: `${rect.left - ARROW_SIZE - ARROW_OFFSET}px`,
      };
      break;
    case 'right':
      arrowStyle = {
        top: `${rect.top + rect.height / 2 - ARROW_SIZE / 2}px`,
        left: `${rect.left + rect.width + ARROW_OFFSET}px`,
      };
      break;
  }

  // 親 (TutorialOverlay) に animation: transform があるため position: fixed が viewport 基準にならず
  // ズレる (transformed ancestor の CSS 既知挙動)。document.body 直下に portal して回避。
  return createPortal(
    <>
      <div
        className="tutorial-highlight"
        style={highlightStyle}
        aria-hidden="true"
      />
      <div
        className={`tutorial-arrow tutorial-arrow--${placement}`}
        style={arrowStyle}
        aria-hidden="true"
      >
        {ARROW_CHAR[placement]}
      </div>
    </>,
    document.body,
  );
}
