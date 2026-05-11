import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';

describe('createRng', () => {
  it('seed 同一なら同列を生成', () => {
    const a = createRng('s1'); const b = createRng('s1');
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it('seed 異なれば違う列', () => {
    const a = createRng('a'); const b = createRng('b');
    expect(a.next()).not.toBe(b.next());
  });
  it('shuffle 全要素保持・順序変化あり', () => {
    const r = createRng('x'); const arr = [1,2,3,4,5,6,7,8,9,10];
    const out = r.shuffle(arr);
    expect(out.slice().sort((x,y)=>x-y)).toEqual(arr);
    expect(out).not.toEqual(arr);   // 期待: 順序変化
  });
  it('choice が配列内の要素', () => {
    const r = createRng('c'); const arr = ['a','b','c'];
    expect(arr).toContain(r.choice(arr));
  });
  it('next() ∈ [0, 1)', () => {
    const r = createRng('z');
    for (let i=0;i<100;i++) { const v = r.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});
