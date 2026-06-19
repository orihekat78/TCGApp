// Task5 FLIP 移動アニメ: pure な FLIP 計算 (rectCenter / computeFlipMoves) の単体テスト。
// hook 本体 (useLayoutEffect + rAF + DOM 計測) は実機 Playwright で検証し、ここでは
// 回転 (sleep/stun) に強い「中心点」ベースの差分計算と zoom スケール補正を確定する。

import { describe, it, expect } from 'vitest';
import {
  rectCenter,
  computeFlipMoves,
  useFlipAnimation,
  type FlipPoint,
} from '@/ui/hooks/useFlipAnimation';

describe('rectCenter', () => {
  it('returns the geometric center of a rect (AABB center == 回転後も中心一致)', () => {
    expect(rectCenter({ left: 10, top: 20, width: 100, height: 60 })).toEqual({
      x: 60,
      y: 50,
    });
  });

  it('handles zero-size rect', () => {
    expect(rectCenter({ left: 5, top: 7, width: 0, height: 0 })).toEqual({ x: 5, y: 7 });
  });
});

function map(entries: Array<[string, FlipPoint]>): Map<string, FlipPoint> {
  return new Map(entries);
}

describe('computeFlipMoves', () => {
  it('returns no moves when positions are unchanged', () => {
    const prev = map([['a', { x: 100, y: 100 }]]);
    const curr = map([['a', { x: 100, y: 100 }]]);
    expect(computeFlipMoves(prev, curr, 1)).toEqual([]);
  });

  it('computes delta = prev - curr (invert vector pointing back to old position)', () => {
    const prev = map([['a', { x: 100, y: 100 }]]);
    const curr = map([['a', { x: 160, y: 130 }]]);
    expect(computeFlipMoves(prev, curr, 1)).toEqual([{ id: 'a', dx: -60, dy: -30 }]);
  });

  it('divides the screen delta by the zoom scale to get local transform px', () => {
    const prev = map([['a', { x: 200, y: 200 }]]);
    const curr = map([['a', { x: 100, y: 100 }]]);
    // screen delta = (+100, +100); under zoom 0.5 the local translate must be (+200, +200)
    expect(computeFlipMoves(prev, curr, 0.5)).toEqual([{ id: 'a', dx: 200, dy: 200 }]);
  });

  it('ignores sub-threshold jitter (< 1px screen by default)', () => {
    const prev = map([['a', { x: 100, y: 100 }]]);
    const curr = map([['a', { x: 100.4, y: 100.3 }]]);
    expect(computeFlipMoves(prev, curr, 1)).toEqual([]);
  });

  it('honors a custom threshold', () => {
    const prev = map([['a', { x: 100, y: 100 }]]);
    const curr = map([['a', { x: 105, y: 100 }]]);
    expect(computeFlipMoves(prev, curr, 1, 10)).toEqual([]);
    expect(computeFlipMoves(prev, curr, 1, 2)).toEqual([{ id: 'a', dx: -5, dy: 0 }]);
  });

  it('skips ids present only in prev (removed card → leave anim handles it)', () => {
    const prev = map([['gone', { x: 0, y: 0 }]]);
    const curr = map([]);
    expect(computeFlipMoves(prev, curr, 1)).toEqual([]);
  });

  it('skips ids present only in curr (newly mounted → CSS enter anim handles it)', () => {
    const prev = map([]);
    const curr = map([['fresh', { x: 0, y: 0 }]]);
    expect(computeFlipMoves(prev, curr, 1)).toEqual([]);
  });

  it('treats non-positive scale as 1 (guard against divide-by-zero)', () => {
    const prev = map([['a', { x: 50, y: 50 }]]);
    const curr = map([['a', { x: 0, y: 0 }]]);
    expect(computeFlipMoves(prev, curr, 0)).toEqual([{ id: 'a', dx: 50, dy: 50 }]);
  });

  it('returns one entry per moved card and omits unmoved ones', () => {
    const prev = map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 100, y: 0 }],
      ['c', { x: 200, y: 0 }],
    ]);
    const curr = map([
      ['a', { x: 0, y: 0 }], // unmoved
      ['b', { x: 0, y: 0 }], // moved left 100
      ['c', { x: 100, y: 0 }], // moved left 100
    ]);
    const moves = computeFlipMoves(prev, curr, 1);
    expect(moves).toEqual([
      { id: 'b', dx: 100, dy: 0 },
      { id: 'c', dx: 100, dy: 0 },
    ]);
  });
});

describe('useFlipAnimation', () => {
  it('is exported as a function', () => {
    expect(typeof useFlipAnimation).toBe('function');
  });
});
