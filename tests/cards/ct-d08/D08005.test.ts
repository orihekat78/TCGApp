// tests/cards/ct-d08/D08005
// spec: .claude/specs/cards-analysis/D08005.md

import { describe, it, expect } from 'vitest';
import { D08005 } from '@/cards/ct-d08/D08005';
import { D08006 } from '@/cards/ct-d08/D08006';

describe('D08005 灰原哀 (character, continuous AP per evidence + declared flip→突撃)', () => {
  it('shape: id, kind, level=7, ap=6000, lp=1, traits科学者+少年探偵団', () => {
    expect(D08005.id).toBe('D08005');
    expect(D08005.no).toBe('0490/D08005');
    expect(D08005.kind).toBe('character');
    expect(D08005.names).toEqual(['灰原哀']);
    expect(D08005.colors).toEqual(['青']);
    expect(D08005.level).toBe(7);
    expect(D08005.ap).toBe(6000);
    expect(D08005.lp).toBe(1);
    expect(D08005.traits).toEqual(['少年探偵団', '科学者']);
    expect(D08005.abilities.length).toBe(2);
  });

  it('a1: continuous (自分ターン中 × apDelta from evidence)', () => {
    const a1 = D08005.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'turn', player: 'self' });
    expect(a1.continuousModifier?.apDelta).toBeDefined();
  });

  it('a2: declared, limit turn1, cost flipFaceUpEvidence, grantKeyword 突撃', () => {
    const a2 = D08005.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('declared');
    expect(a2.limit).toEqual({ kind: 'turn', n: 1 });
    expect(a2.cost?.kind).toBe('flipFaceUpEvidence');
    const eff = a2.effect as { kind: string; verb: string; args: { kw: string } };
    expect(eff.kind).toBe('atom');
    expect(eff.verb).toBe('charGrantKeyword');
    expect(eff.args.kw).toBe('突撃');
  });

  it('D08006 variant shares abilities with D08005', () => {
    expect(D08006.abilities).toBe(D08005.abilities);
    expect(D08006.id).toBe('D08006');
    expect(D08006.imageUrl).not.toBe(D08005.imageUrl);
  });
});
