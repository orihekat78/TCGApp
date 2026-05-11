// tests/cards/ct-d11/D11007
// spec: .claude/specs/cards-analysis/D11007.md

import { describe, it, expect } from 'vitest';
import { D11007 } from '@/cards/ct-d11/D11007';
import { D11008 } from '@/cards/ct-d11/D11008';

describe('D11007 松田陣平 (対象拡張 + partnerColor 突撃 + contact revenge)', () => {
  it('shape: id, level=6, ap=5000, lp=1, 黄, 警察|警視庁', () => {
    expect(D11007.id).toBe('D11007');
    expect(D11007.no).toBe('0938/D11007');
    expect(D11007.level).toBe(6);
    expect(D11007.ap).toBe(5000);
    expect(D11007.lp).toBe(1);
    expect(D11007.abilities.length).toBe(3);
  });

  it('a1 = continuous target expansion (active L7+ targetable)', () => {
    const a1 = D11007.abilities[0];
    expect(a1.type).toBe('continuous');
    expect(a1.scope).toBe('on-scene');
    expect(a1.description).toMatch(/レベル7以上/);
    expect(typeof a1.continuousModifier?.customSelectorPatch).toBe('function');
  });

  it('a2 = partnerColor 黄 突撃 (continuous)', () => {
    const a2 = D11007.abilities[1];
    expect(a2.type).toBe('continuous');
    expect(a2.description).toMatch(/突撃/);
  });

  it('a3 = triggered contact:start, limit turn 1, optional self AP+3000 + discard', () => {
    const a3 = D11007.abilities[2];
    expect(a3.type).toBe('triggered');
    expect(a3.trigger?.hook).toBe('contact:start');
    expect(a3.limit).toEqual({ kind: 'turn', n: 1 });
    expect(a3.condition).toEqual({ kind: 'turn', player: 'self' });
    expect(a3.effect?.kind).toBe('optional');
  });

  it('D11008 variant shares abilities with D11007', () => {
    expect(D11008.abilities).toBe(D11007.abilities);
    expect(D11008.id).toBe('D11008');
    expect(D11008.imageUrl).not.toBe(D11007.imageUrl);
  });
});
