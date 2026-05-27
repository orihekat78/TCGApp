// tests/cards/ct-d08/D08023
// spec: .claude/specs/cards-analysis/D08023.md

import { describe, it, expect } from 'vitest';
import { D08023 } from '@/cards/ct-d08/D08023';

describe('D08023 毛利蘭 (character, cutinFixedAP 2000)', () => {
  it('shape: id, kind, level=3, ap=2000, lp=1, color=青', () => {
    expect(D08023.id).toBe('D08023');
    expect(D08023.no).toBe('0096/D08023');
    expect(D08023.kind).toBe('character');
    expect(D08023.names).toEqual(['毛利蘭']);
    expect(D08023.colors).toEqual(['青']);
    expect(D08023.level).toBe(3);
    expect(D08023.ap).toBe(2000);
    expect(D08023.lp).toBe(1);
    expect(D08023.traits).toEqual(['高校生', '毛利探偵事務所', '空手家']);
    expect(D08023.abilities.length).toBe(1);
  });

  it('a1: cutinFixedAP delta=2000', () => {
    const a1 = D08023.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('effect:declared');
    expect(a1.trigger?.optional).toBe(true);
    expect(a1.description).toMatch(/2000/);
  });
});
