// tests/cards/ct-d08/D08009
// spec: .claude/specs/cards-analysis/D08009.md

import { describe, it, expect } from 'vitest';
import { D08009 } from '@/cards/ct-d08/D08009';
import { D08010 } from '@/cards/ct-d08/D08010';

describe('D08009 小嶋元太 (character, partnerColorKeyword 突撃)', () => {
  it('shape: id, kind, level=5, ap=5000, lp=0', () => {
    expect(D08009.id).toBe('D08009');
    expect(D08009.no).toBe('0492/D08009');
    expect(D08009.kind).toBe('character');
    expect(D08009.names).toEqual(['小嶋元太']);
    expect(D08009.colors).toEqual(['青']);
    expect(D08009.level).toBe(5);
    expect(D08009.ap).toBe(5000);
    expect(D08009.lp).toBe(0);
    expect(D08009.traits).toEqual(['少年探偵団']);
    expect(D08009.abilities.length).toBe(1);
  });

  it('a1: partnerColorKeyword 青 → 突撃', () => {
    const a1 = D08009.abilities[0];
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '青' });
    expect(a1.description).toMatch(/突撃/);
  });

  it('D08010 variant shares abilities with D08009', () => {
    expect(D08010.abilities).toBe(D08009.abilities);
    expect(D08010.id).toBe('D08010');
    expect(D08010.imageUrl).not.toBe(D08009.imageUrl);
  });
});
