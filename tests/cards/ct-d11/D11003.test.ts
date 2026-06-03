// tests/cards/ct-d11/D11003
// spec: .claude/specs/cards-analysis/D11003.md

import { describe, it, expect } from 'vitest';
import { D11003 } from '@/cards/ct-d11/D11003';
import { D11004 } from '@/cards/ct-d11/D11004';

describe('D11003 萩原千速 (疾風+宣言+ヒラメキ)', () => {
  it('shape: id, level=8, ap=8000, lp=1, 黄, 警察|神奈川県警', () => {
    expect(D11003.id).toBe('D11003');
    expect(D11003.no).toBe('0936/D11003');
    expect(D11003.kind).toBe('character');
    expect(D11003.colors).toEqual(['黄']);
    expect(D11003.level).toBe(8);
    expect(D11003.ap).toBe(8000);
    expect(D11003.lp).toBe(1);
    expect(D11003.traits).toEqual(['警察', '神奈川県警']);
    expect(D11003.abilities.length).toBe(3);
  });

  it('a1 = 疾風 enter triggered (enterOrderEquals matcherCondition) → evidenceGain', () => {
    const a1 = D11003.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('enter');
    // BUG-100: closure matcher (累積 enterOrder) → enterOrderEquals matcherCondition (turn-local)
    expect(a1.trigger?.matcher).toBeUndefined();
    expect(a1.trigger?.matcherCondition).toEqual({ kind: 'enterOrderEquals', n: 1 });
    expect(a1.effect?.kind).toBe('atom');
  });

  it('a2 = caseTraitConditioned(婚活) wrapping declared sleepSelf + sceneHas警察>=2', () => {
    const a2 = D11003.abilities[1];
    expect(a2.type).toBe('declared');
    expect(a2.description).toMatch(/事件婚活/);
    expect(a2.cost?.kind).toBe('sleepSelf');
    // outer caseTrait AND inner sceneHas
    expect(a2.condition?.kind).toBe('and');
  });

  it('a3 = icon-flash activate choice', () => {
    const a3 = D11003.abilities[2];
    expect(a3.type).toBe('triggered');
    expect(a3.trigger?.hook).toBe('evidence:remove-by-action');
    expect(a3.trigger?.optional).toBe(true);
    expect(a3.description).toMatch(/アクティブ/);
  });

  it('D11004 variant shares abilities with D11003', () => {
    expect(D11004.abilities).toBe(D11003.abilities);
    expect(D11004.id).toBe('D11004');
    expect(D11004.imageUrl).not.toBe(D11003.imageUrl);
  });
});
