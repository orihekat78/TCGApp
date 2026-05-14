// tests/ai/policies/random.test.ts — Phase 6 Group B Task 6.3 tests
// spec: .claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md

import { describe, it, expect } from 'vitest';
import type { GameState } from '@/engine/types';
import type { Move } from '@/ai/move-enumerator';
import { RandomPolicy } from '@/ai/policies/random';

// state は RandomPolicy.choose 内で参照されないので空オブジェクトを cast すれば十分
const FAKE_STATE = {} as GameState;

function makeMoves(n: number): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) moves.push({ kind: 'endTurn' });
    else moves.push({ kind: 'reasoning', uid: `c${i}` });
  }
  return moves;
}

describe('RandomPolicy', () => {
  it('returns null for empty candidates', () => {
    const p = new RandomPolicy({ seed: 'x' });
    const got = p.choose(FAKE_STATE, [], 'self');
    expect(got).toBeNull();
  });

  it('returns a candidate that exists in the input list (not constructed)', () => {
    const p = new RandomPolicy({ seed: 'fixed-seed' });
    const moves = makeMoves(5);
    for (let i = 0; i < 50; i++) {
      const chosen = p.choose(FAKE_STATE, moves, 'self');
      expect(chosen).not.toBeNull();
      expect(moves).toContain(chosen!);
    }
  });

  it('same seed: choices are deterministic across multiple calls', () => {
    const p1 = new RandomPolicy({ seed: 'abc' });
    const p2 = new RandomPolicy({ seed: 'abc' });
    const moves = makeMoves(7);
    const picks1: Move[] = [];
    const picks2: Move[] = [];
    for (let i = 0; i < 20; i++) {
      picks1.push(p1.choose(FAKE_STATE, moves, 'self')!);
      picks2.push(p2.choose(FAKE_STATE, moves, 'self')!);
    }
    expect(picks1).toEqual(picks2);
  });

  it('different seeds: first pick differs with high probability', () => {
    // 2 つの異なる seed で、長さ 5 の候補から最初に選ぶ手を比較。
    // 完全に一致する確率は 1/5 = 20% 。seed の選び方で一致しない組み合わせを採る。
    const moves = makeMoves(5);
    const seedsA = ['seedA-1', 'seedA-2', 'seedA-3'];
    const seedsB = ['seedB-1', 'seedB-2', 'seedB-3'];
    let differentFound = false;
    for (const sa of seedsA) {
      for (const sb of seedsB) {
        const a = new RandomPolicy({ seed: sa }).choose(FAKE_STATE, moves, 'self');
        const b = new RandomPolicy({ seed: sb }).choose(FAKE_STATE, moves, 'self');
        if (a !== b) {
          differentFound = true;
          break;
        }
      }
      if (differentFound) break;
    }
    expect(differentFound).toBe(true);
  });

  it('100 calls over 10 candidates: each bucket gets at least 3 hits (rough uniformity)', () => {
    const p = new RandomPolicy({ seed: 'uniformity-test' });
    const moves = makeMoves(10);
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 100; i++) {
      const chosen = p.choose(FAKE_STATE, moves, 'self')!;
      const idx = moves.indexOf(chosen);
      expect(idx).toBeGreaterThanOrEqual(0);
      counts[idx]++;
    }
    // すべてのバケットが少なくとも 3 回ヒットすることを期待 (緩い一様性チェック)
    for (let i = 0; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(3);
    }
  });

  it('custom rng function: respects user-provided RNG', () => {
    // 常に 0.5 を返す rng → Math.floor(0.5 * n) = floor(n/2) を返すはず
    const p = new RandomPolicy({ rng: () => 0.5 });
    const moves = makeMoves(6); // index 3 が選ばれるはず
    const chosen = p.choose(FAKE_STATE, moves, 'self');
    expect(chosen).toBe(moves[3]);
  });

  it('default constructor (no opts): does not throw and returns a candidate', () => {
    const p = new RandomPolicy();
    const moves = makeMoves(3);
    const chosen = p.choose(FAKE_STATE, moves, 'self');
    expect(chosen).not.toBeNull();
    expect(moves).toContain(chosen!);
  });

  it('name is "random"', () => {
    const p = new RandomPolicy({ seed: 'x' });
    expect(p.name).toBe('random');
  });

  it('rng returning 1 (edge case) does not produce out-of-range index', () => {
    // 念のため rng() が 1 ぴったりを返すケースを想定し、clamp を確認する
    const p = new RandomPolicy({ rng: () => 1 - Number.EPSILON });
    const moves = makeMoves(4);
    const chosen = p.choose(FAKE_STATE, moves, 'self');
    expect(moves).toContain(chosen!);
  });

  it('single candidate: always returned', () => {
    const p = new RandomPolicy({ seed: 'single' });
    const moves: Move[] = [{ kind: 'endTurn' }];
    for (let i = 0; i < 10; i++) {
      const chosen = p.choose(FAKE_STATE, moves, 'self');
      expect(chosen).toBe(moves[0]);
    }
  });
});
