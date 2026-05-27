// tests/cards/ct-d11/D11018
// spec: .claude/specs/cards-analysis/D11018.md

import { describe, it, expect } from 'vitest';
import { D11018 } from '@/cards/ct-d11/D11018';

describe('D11018 佐藤美和子 (cutinFixedAP)', () => {
  it('shape: id=D11018, level=2, ap=1000, lp=1, 黄, 警察|警視庁', () => {
    expect(D11018.id).toBe('D11018');
    expect(D11018.no).toBe('0343/D11018');
    expect(D11018.kind).toBe('character');
    expect(D11018.names).toEqual(['佐藤美和子']);
    expect(D11018.colors).toEqual(['黄']);
    expect(D11018.level).toBe(2);
    expect(D11018.ap).toBe(1000);
    expect(D11018.lp).toBe(1);
    expect(D11018.traits).toEqual(['警察', '警視庁']);
  });

  it('a1 is icon-cutin AP+2000', () => {
    const a = D11018.abilities[0];
    expect(a.type).toBe('triggered');
    expect(a.trigger?.hook).toBe('effect:declared');
    expect(a.trigger?.optional).toBe(true);
    expect(a.description).toMatch(/2000/);
  });
});
