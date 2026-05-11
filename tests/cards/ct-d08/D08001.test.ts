// tests/cards/ct-d08/D08001
// spec: .claude/specs/cards-analysis/D08001.md

import { describe, it, expect } from 'vitest';
import { D08001 } from '@/cards/ct-d08/D08001';

describe('D08001 江戸川コナン (partner)', () => {
  it('shape: id, kind, names, colors, lp, rarity', () => {
    expect(D08001.id).toBe('D08001');
    expect(D08001.no).toBe('P001/D08001');
    expect(D08001.kind).toBe('partner');
    expect(D08001.names).toEqual(['江戸川コナン']);
    expect(D08001.colors).toEqual(['青']);
    expect(D08001.lp).toBe(1);
    expect(D08001.rarity).toBe('D');
    expect(D08001.imageUrl).toBeTruthy();
  });

  it('全パートナー共通能力は engine 内蔵 → abilities は空配列', () => {
    expect(D08001.abilities).toEqual([]);
  });

  it('ruleRefs が rules/01 (勝利) と rules/13 (キーワード) を参照', () => {
    expect(D08001.ruleRefs.length).toBeGreaterThan(0);
    expect(D08001.ruleRefs.some(r => r.includes('01'))).toBe(true);
    expect(D08001.ruleRefs.some(r => r.includes('13'))).toBe(true);
  });
});
