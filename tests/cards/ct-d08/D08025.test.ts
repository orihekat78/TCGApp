// tests/cards/ct-d08/D08025
// spec: .claude/specs/cards-analysis/D08025.md

import { describe, it, expect } from 'vitest';
import { D08025 } from '@/cards/ct-d08/D08025';

describe('D08025 蘭の一撃 (event)', () => {
  it('shape: id, kind, level=5, color=青', () => {
    expect(D08025.id).toBe('D08025');
    expect(D08025.no).toBe('0103/D08025');
    expect(D08025.kind).toBe('event');
    expect(D08025.names).toEqual(['蘭の一撃']);
    expect(D08025.colors).toEqual(['青']);
    expect(D08025.level).toBe(5);
  });

  it('a1: eventRemoveByAP { apMax:8000, partnerColor:青 }', () => {
    const a1 = D08025.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.description).toMatch(/AP8000以下/);
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '青' });
  });

  it('ruleRefs 非空', () => {
    expect(D08025.ruleRefs.length).toBeGreaterThan(0);
  });
});
