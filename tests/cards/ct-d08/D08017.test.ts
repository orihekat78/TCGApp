// tests/cards/ct-d08/D08017
// spec: .claude/specs/cards-analysis/D08017.md

import { describe, it, expect } from 'vitest';
import { D08017 } from '@/cards/ct-d08/D08017';
import { D08018 } from '@/cards/ct-d08/D08018';

describe('D08017 円谷光彦 (character)', () => {
  it('shape: id, kind, level=2, ap=1000, lp=1, color=青', () => {
    expect(D08017.id).toBe('D08017');
    expect(D08017.no).toBe('0496/D08017');
    expect(D08017.kind).toBe('character');
    expect(D08017.names).toEqual(['円谷光彦']);
    expect(D08017.colors).toEqual(['青']);
    expect(D08017.level).toBe(2);
    expect(D08017.ap).toBe(1000);
    expect(D08017.lp).toBe(1);
    expect(D08017.traits).toEqual(['少年探偵団']);
    expect(D08017.abilities.length).toBe(1);
    expect(D08017.ruleRefs.length).toBeGreaterThan(0);
  });

  it('a1: cutinFixedAP delta=2000', () => {
    const a1 = D08017.abilities[0];
    expect(a1.type).toBe('icon-cutin');
    expect(a1.description).toMatch(/2000/);
  });

  it('D08018 variant shares abilities with D08017 (different id/imageUrl)', () => {
    expect(D08018.abilities).toBe(D08017.abilities);
    expect(D08018.id).toBe('D08018');
    expect(D08018.no).toBe('0496/D08018');
    expect(D08018.imageUrl).not.toBe(D08017.imageUrl);
    expect(D08018.names).toEqual(D08017.names);
    expect(D08018.ap).toBe(D08017.ap);
  });
});
