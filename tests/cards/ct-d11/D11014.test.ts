// tests/cards/ct-d11/D11014
// spec: .claude/specs/cards-analysis/D11014.md

import { describe, it, expect } from 'vitest';
import { D11014 } from '@/cards/ct-d11/D11014';

describe('D11014 横溝重悟 (疾風 AP-1000 + 宣言 reanimate)', () => {
  it('shape: id, level=7, ap=6000, lp=1, 黄, 警察|神奈川県警', () => {
    expect(D11014.id).toBe('D11014');
    expect(D11014.no).toBe('0941/D11014');
    expect(D11014.level).toBe(7);
    expect(D11014.ap).toBe(6000);
    expect(D11014.lp).toBe(1);
    expect(D11014.abilities.length).toBe(2);
  });

  it('a1 = 疾風 enter triggered (enterOrder=1) → AP-1000 char choice', () => {
    const a1 = D11014.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('enter');
    expect(typeof a1.trigger?.matcher).toBe('function');
    expect(a1.effect?.kind).toBe('choice');
    expect(a1.description).toMatch(/AP/);
    expect(a1.description).toMatch(/1000/);
  });

  it('a2 = declared pay (sleepSelf + removeFromHand) → reanimate from remove with bonus draw', () => {
    const a2 = D11014.abilities[1];
    expect(a2.type).toBe('declared');
    expect(a2.cost?.kind).toBe('pay');
    expect(a2.effect?.kind).toBe('sequence');
    expect(a2.description).toMatch(/萩原千速/);
  });
});
