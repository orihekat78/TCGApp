// tests/cards/ct-d11/D11017
// spec: .claude/specs/cards-analysis/D11017.md

import { describe, it, expect } from 'vitest';
import { D11017 } from '@/cards/ct-d11/D11017';
import { D11018 } from '@/cards/ct-d11/D11018';

describe('D11017 高木渉 (cutinFixedAP)', () => {
  it('shape: id, level=2, ap=1000, lp=1, 黄, 警察|警視庁', () => {
    expect(D11017.id).toBe('D11017');
    expect(D11017.no).toBe('0943/D11017');
    expect(D11017.kind).toBe('character');
    expect(D11017.colors).toEqual(['黄']);
    expect(D11017.level).toBe(2);
    expect(D11017.ap).toBe(1000);
    expect(D11017.lp).toBe(1);
    expect(D11017.traits).toEqual(['警察', '警視庁']);
    expect(D11017.abilities.length).toBe(1);
  });

  it('a1 is icon-cutin AP+2000', () => {
    const a = D11017.abilities[0];
    expect(a.type).toBe('icon-cutin');
    expect(a.description).toMatch(/2000/);
  });

  it('D11018 is a separate analysis card (not a variant of D11017)', () => {
    expect(D11018.id).toBe('D11018');
    expect(D11018.names).toEqual(['佐藤美和子']);
    expect(D11018.no).toBe('0343/D11018');
    expect(D11018.id).not.toBe(D11017.id);
  });
});
