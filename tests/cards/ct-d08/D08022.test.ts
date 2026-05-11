// tests/cards/ct-d08/D08022
// spec: .claude/specs/cards-analysis/D08022.md

import { describe, it, expect } from 'vitest';
import { D08022 } from '@/cards/ct-d08/D08022';

describe('D08022 江戸川コナン (character, partnerColorKeyword 迅速)', () => {
  it('shape: id, kind, level=7, ap=6000, lp=1, color=青', () => {
    expect(D08022.id).toBe('D08022');
    expect(D08022.no).toBe('0091/D08022');
    expect(D08022.kind).toBe('character');
    expect(D08022.names).toEqual(['江戸川コナン']);
    expect(D08022.colors).toEqual(['青']);
    expect(D08022.level).toBe(7);
    expect(D08022.ap).toBe(6000);
    expect(D08022.lp).toBe(1);
    expect(D08022.traits).toEqual(['探偵', '毛利探偵事務所', '少年探偵団']);
    expect(D08022.abilities.length).toBe(1);
  });

  it('a1: partnerColorKeyword 青 → 迅速', () => {
    const a1 = D08022.abilities[0];
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '青' });
    expect(a1.description).toMatch(/迅速/);
    expect(a1.continuousModifier?.grantKeywords).toBeDefined();
  });
});
