import { describe, it, expect } from 'vitest';
const { buildExemplarSet } = require('../../scripts/build-exemplar-set.cjs');

describe('buildExemplarSet', () => {
  it('全カードの token を union、skeleton を集合化', () => {
    const shipped = [
      { id: 'X1', abilities: [{ type: 'declared', description: 'd', effect: { kind: 'atom', verb: 'draw', n: 1 } }] },
      { id: 'X2', abilities: [{ type: 'declared', description: 'd', effect: { kind: 'atom', verb: 'draw', n: 2 } }] },
    ];
    const e = buildExemplarSet(shipped);
    expect(e.tokens).toContain('verb:draw');
    expect(e.cards).toBe(2);
    expect(e.skeletons.length).toBe(1); // n だけ違う → 同一 skeleton
  });
});
