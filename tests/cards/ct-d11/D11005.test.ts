// tests/cards/ct-d11/D11005
// spec: .claude/specs/cards-analysis/D11005.md

import { describe, it, expect } from 'vitest';
import { D11005 } from '@/cards/ct-d11/D11005';
import { D11006 } from '@/cards/ct-d11/D11006';

describe('D11005 横溝重悟 (登場時自AP以下リムーブ + 宣言挑発)', () => {
  it('shape: id, level=8, ap=8000, lp=1, 黄, 警察|神奈川県警', () => {
    expect(D11005.id).toBe('D11005');
    expect(D11005.no).toBe('0937/D11005');
    expect(D11005.colors).toEqual(['黄']);
    expect(D11005.level).toBe(8);
    expect(D11005.ap).toBe(8000);
    expect(D11005.lp).toBe(1);
    expect(D11005.abilities.length).toBe(2);
  });

  it('a1 = caseTraitConditioned(婚活) wrapping enter triggered with sceneRemove choice', () => {
    const a1 = D11005.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('enter');
    expect(a1.description).toMatch(/事件婚活/);
    expect(a1.effect?.kind).toBe('choice');
  });

  it('a2 = declared sleepSelf → charSetTurnEffect mustBeTargeted (opp-turn)', () => {
    const a2 = D11005.abilities[1];
    expect(a2.type).toBe('declared');
    expect(a2.cost?.kind).toBe('sleepSelf');
    expect(a2.effect?.kind).toBe('atom');
    expect(a2.description).toMatch(/挑発|必ず指定/);
  });

  it('D11006 variant shares abilities with D11005', () => {
    expect(D11006.abilities).toBe(D11005.abilities);
    expect(D11006.id).toBe('D11006');
    expect(D11006.imageUrl).not.toBe(D11005.imageUrl);
  });
});
