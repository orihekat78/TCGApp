// tests/cards/ct-d11/D11011
// spec: .claude/specs/cards-analysis/D11011.md

import { describe, it, expect } from 'vitest';
import { D11011 } from '@/cards/ct-d11/D11011';

describe('D11011 萩原千速 (partnerColor 黄 + 解決編 → 迅速)', () => {
  it('shape: id=D11011, level=5, ap=5000, lp=0, 黄, 警察|神奈川県警', () => {
    expect(D11011.id).toBe('D11011');
    expect(D11011.no).toBe('0461/D11011');
    expect(D11011.kind).toBe('character');
    expect(D11011.colors).toEqual(['黄']);
    expect(D11011.level).toBe(5);
    expect(D11011.ap).toBe(5000);
    expect(D11011.lp).toBe(0);
    expect(D11011.traits).toEqual(['警察', '神奈川県警']);
    expect(D11011.abilities.length).toBe(1);
  });

  it('a1 = continuous partnerColorKeyword(迅速) with caseStatus 解決編 AND condition', () => {
    const a = D11011.abilities[0];
    expect(a.type).toBe('continuous');
    expect(a.scope).toBe('on-scene');
    // partnerColorKeyword combines via { kind:'and', cs: [...] }
    expect(a.condition?.kind).toBe('and');
    expect(a.description).toMatch(/迅速/);
  });
});
