// tests/cards/ct-d08/D08021
// spec: .claude/specs/cards-analysis/D08021.md

import { describe, it, expect } from 'vitest';
import { D08021 } from '@/cards/ct-d08/D08021';

describe('D08021 結成 少年探偵団 (character, enter stack + threshold abilities)', () => {
  it('shape: id, kind, level=8, ap=8000, lp=2', () => {
    expect(D08021.id).toBe('D08021');
    expect(D08021.no).toBe('0264/D08021');
    expect(D08021.kind).toBe('character');
    expect(D08021.names).toEqual(['結成 少年探偵団']);
    expect(D08021.colors).toEqual(['青']);
    expect(D08021.level).toBe(8);
    expect(D08021.ap).toBe(8000);
    expect(D08021.lp).toBe(2);
    expect(D08021.traits).toEqual(['少年探偵団']);
    expect(D08021.abilities.length).toBe(4);
  });

  it('a1: enter triggered (charStackCard from remove with distinctNames)', () => {
    const a1 = D08021.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('enter');
    expect(a1.trigger?.selfOnly).toBe(true);
    expect(a1.effect?.kind).toBe('choice');
  });

  it('a2: continuous stackedCount≥1 → grant 突撃', () => {
    const a2 = D08021.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('continuous');
    expect(a2.condition).toEqual({
      kind: 'stackedCountAtLeast',
      ref: { kind: 'self' },
      n: 1,
    });
    expect(a2.continuousModifier?.grantKeywords).toBeDefined();
  });

  it('a3: triggered (action:declare, stackedCount≥3 → draw 1)', () => {
    const a3 = D08021.abilities[2];
    expect(a3.id).toBe('a3');
    expect(a3.type).toBe('triggered');
    expect(a3.trigger?.hook).toBe('action:declare');
    expect(a3.condition).toEqual({
      kind: 'stackedCountAtLeast',
      ref: { kind: 'self' },
      n: 3,
    });
  });

  it('a4: triggered (action:declare, stackedCount≥5 → evidence+1)', () => {
    const a4 = D08021.abilities[3];
    expect(a4.id).toBe('a4');
    expect(a4.type).toBe('triggered');
    expect(a4.condition).toEqual({
      kind: 'stackedCountAtLeast',
      ref: { kind: 'self' },
      n: 5,
    });
  });
});
