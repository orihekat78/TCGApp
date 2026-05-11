// tests/cards/ct-d08/D08011
// spec: .claude/specs/cards-analysis/D08011.md

import { describe, it, expect } from 'vitest';
import { D08011 } from '@/cards/ct-d08/D08011';
import { D08012 } from '@/cards/ct-d08/D08012';

describe('D08011 円谷光彦 (character, enter conditional self 突撃)', () => {
  it('shape: id, kind, level=6, ap=5000, lp=1', () => {
    expect(D08011.id).toBe('D08011');
    expect(D08011.no).toBe('0493/D08011');
    expect(D08011.kind).toBe('character');
    expect(D08011.names).toEqual(['円谷光彦']);
    expect(D08011.colors).toEqual(['青']);
    expect(D08011.level).toBe(6);
    expect(D08011.ap).toBe(5000);
    expect(D08011.lp).toBe(1);
    expect(D08011.abilities.length).toBe(1);
  });

  it('a1: enter trigger with sceneHas[少年探偵団]≥1 excludeSelf condition → grant 突撃', () => {
    const a1 = D08011.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('enter');
    expect(a1.trigger?.selfOnly).toBe(true);
    expect(a1.effect?.kind).toBe('conditional');
    expect(a1.description).toMatch(/突撃/);
  });

  it('D08012 variant shares abilities with D08011', () => {
    expect(D08012.abilities).toBe(D08011.abilities);
    expect(D08012.id).toBe('D08012');
    expect(D08012.imageUrl).not.toBe(D08011.imageUrl);
  });
});
