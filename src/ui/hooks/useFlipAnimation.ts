// Task5: FLIP 移動アニメ (polish)。
//
// 目的: 現場 (scene) のカードがレイアウト reflow で「ジャンプ」するのを滑らかなスライドに変える。
//   flex 子の並び替え (キャラ追加/除去/スイッチ) は position の変化であり transform ではないため、
//   既存の `.scene-area .card { transition: transform 0.3s }` だけでは何もアニメしない (瞬間移動)。
//   FLIP (First-Last-Invert-Play) で前回との矩形差分を一旦 transform で打ち消し、次フレームで 0 に
//   戻すことで CSS transition に乗せて移動トゥイーンする。
//
// なぜ MutationObserver 駆動か (React dep ではなく):
//   除去カードは SceneArea 内部で 420ms の「ゴースト」(.removing) として残り、その消滅は
//   gameState ではなく SceneArea のローカル state 変化で起きる。dep=gameState の useLayoutEffect では
//   ゴースト消滅後の「最終位置への詰め直し」を検知できず、その肝心の移動がアニメせず瞬間移動になる。
//   childList を監視する MutationObserver なら「追加 / 除去 / 並び替え / ゴースト消滅」すべての
//   構造変化を React state に依存せず捕捉でき、毎回 FLIP を回せる。
//
// 設計上の注意点 (このコードベース固有):
//   1. `.board-content` は CSS `zoom` (BUG-150)。getBoundingClientRect は zoom 後の画面座標を返すので、
//      要素 local へ与える translate は「画面差分 / zoom」に補正する (zoom は computed style から読む)。
//   2. scene カードは sleep=rotate(-90deg) / stun=rotate(180deg) / is-active-pop=scale 等の CSS
//      transform を持つ。inline transform はこれらを上書きするため、getComputedStyle の現在 matrix を
//      後ろに合成し (translate(dx,dy) <matrix>) 回転/拡大を保ったままスライドさせる。回転に強い差分の
//      ため矩形ではなく「中心点」で計測する (AABB 中心 == 任意回転でカード中心)。
//   3. 対象は `data-flip-id` を持つ要素のみ。ゴーストには付与しない (SceneArea 側で制御) ことで
//      leave アニメと衝突させない。childList のみ監視するので inline style 書込みでは自己発火しない。
//
// rules: UI polish のみ。engine 不変 (骨格凍結原則)。

import { useEffect, useRef, type RefObject } from 'react';

export interface FlipRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FlipPoint {
  x: number;
  y: number;
}

export interface FlipMove {
  id: string;
  dx: number;
  dy: number;
}

export interface FlipOptions {
  /** これ未満 (画面 px) の移動はノイズとして無視 (default 1px) */
  threshold?: number;
}

const FLIP_ATTR = 'data-flip-id';
const DEFAULT_THRESHOLD = 1;

/** 矩形の幾何中心。回転しても AABB 中心 == カード中心なので回転に強い。 */
export function rectCenter(r: FlipRectLike): FlipPoint {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * 前回中心 (prev) と現在中心 (curr) の差分から、各カードに与える FLIP invert ベクトルを計算する純関数。
 *  - delta = prev - curr (= 古い位置へ戻すベクトル)
 *  - zoom scale で割って要素 local px に補正
 *  - prev/curr の片方にしか無い id (新規 mount / 退場) はスキップ
 *  - threshold 未満のサブピクセル移動はスキップ
 */
export function computeFlipMoves(
  prev: ReadonlyMap<string, FlipPoint>,
  curr: ReadonlyMap<string, FlipPoint>,
  scale: number,
  threshold: number = DEFAULT_THRESHOLD,
): FlipMove[] {
  const s = scale > 0 ? scale : 1;
  const moves: FlipMove[] = [];
  for (const [id, c] of curr) {
    const p = prev.get(id);
    if (!p) continue; // 新規 mount → CSS enter アニメに任せる
    const dxScreen = p.x - c.x;
    const dyScreen = p.y - c.y;
    if (Math.hypot(dxScreen, dyScreen) < threshold) continue;
    moves.push({ id, dx: dxScreen / s, dy: dyScreen / s });
  }
  return moves;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** root の computed `zoom` を読む (BUG-150 の board-content zoom)。取れなければ 1。 */
function readZoom(root: HTMLElement): number {
  const z = parseFloat(getComputedStyle(root).zoom);
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/** root 配下の data-flip-id 要素を計測して id→中心 / id→要素 を返す。 */
function measureCenters(root: HTMLElement): {
  centers: Map<string, FlipPoint>;
  elById: Map<string, HTMLElement>;
} {
  const centers = new Map<string, FlipPoint>();
  const elById = new Map<string, HTMLElement>();
  const els = root.querySelectorAll<HTMLElement>(`[${FLIP_ATTR}]`);
  els.forEach((el) => {
    const id = el.getAttribute(FLIP_ATTR);
    if (!id) return;
    centers.set(id, rectCenter(el.getBoundingClientRect()));
    elById.set(id, el);
  });
  return { centers, elById };
}

/** Invert (古い位置へ瞬間移動) → 次フレームで解除 (CSS transition で Play)。 */
function playInvert(el: HTMLElement, dx: number, dy: number, rafs: number[]): void {
  // 現在の resting transform (回転/拡大) を後ろに合成して保持する
  const base = getComputedStyle(el).transform;
  const basePart = base && base !== 'none' ? ` ${base}` : '';
  el.style.transition = 'none';
  el.style.transform = `translate(${dx}px, ${dy}px)${basePart}`;
  // transition:none の inverted フレームを同期コミット (reflow を強制)
  void el.getBoundingClientRect();
  const id = requestAnimationFrame(() => {
    // inline を解除 → CSS の transition: transform 0.3s に乗って base 位置へスライド
    el.style.transition = '';
    el.style.transform = '';
    const i = rafs.indexOf(id);
    if (i >= 0) rafs.splice(i, 1);
  });
  rafs.push(id);
}

/**
 * FLIP 移動アニメ hook。`ref` 配下の `[data-flip-id]` 要素について、childList 構造変化
 * (カード追加/除去/並び替え/ゴースト消滅) のたびに前回からの位置差分を移動トゥイーンする。
 *
 * @param ref     計測対象を含むコンテナ (例: `.board-content`)。zoom もここから読む。
 * @param options threshold 等
 */
export function useFlipAnimation(
  ref: RefObject<HTMLElement | null>,
  options: FlipOptions = {},
): void {
  const prevRef = useRef<Map<string, FlipPoint>>(new Map());
  const rafsRef = useRef<number[]>([]);
  const thresholdRef = useRef(options.threshold);
  thresholdRef.current = options.threshold;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // baseline
    prevRef.current = measureCenters(root).centers;

    const runFlip = (): void => {
      const { centers: curr, elById } = measureCenters(root);
      if (!prefersReducedMotion()) {
        const moves = computeFlipMoves(prevRef.current, curr, readZoom(root), thresholdRef.current);
        for (const mv of moves) {
          const el = elById.get(mv.id);
          if (el) playInvert(el, mv.dx, mv.dy, rafsRef.current);
        }
      }
      prevRef.current = curr;
    };

    // childList のみ監視 (inline style 書込みは attribute なので自己発火しない)。
    const obs = new MutationObserver(() => runFlip());
    obs.observe(root, { childList: true, subtree: true });

    // resize/zoom 変化は「アニメせず」基準だけ取り直す (zoom 差分を移動と誤認しない)。
    const remeasure = (): void => {
      prevRef.current = measureCenters(root).centers;
    };
    window.addEventListener('resize', remeasure);
    window.addEventListener('orientationchange', remeasure);

    const rafs = rafsRef.current;
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('orientationchange', remeasure);
      rafs.forEach((id) => cancelAnimationFrame(id));
      rafs.length = 0;
    };
  }, [ref]);
}
