// tests/cards/ct-d11/D11009
// spec: .claude/specs/cards-analysis/D11009.md

import { describe, it, expect } from 'vitest';
import { D11009 } from '@/cards/ct-d11/D11009';
import { D11010 } from '@/cards/ct-d11/D11010';

describe('D11009 萩原研二 (partnerColor 突撃[キャラ] + 疾風 sleep + ヒラメキ sleep)', () => {
  it('shape: id=D11009, level=7, ap=6000, lp=1, 黄, 警察|警視庁', () => {
    expect(D11009.id).toBe('D11009');
    expect(D11009.no).toBe('0939/D11009');
    expect(D11009.kind).toBe('character');
    expect(D11009.colors).toEqual(['黄']);
    expect(D11009.level).toBe(7);
    expect(D11009.ap).toBe(6000);
    expect(D11009.lp).toBe(1);
    expect(D11009.traits).toEqual(['警察', '警視庁']);
    expect(D11009.abilities.length).toBe(3);
  });

  it('a1 = partnerColorKeyword 突撃[キャラ] (continuous)', () => {
    const a1 = D11009.abilities[0];
    expect(a1.type).toBe('continuous');
    expect(a1.description).toMatch(/突撃\[キャラ\]/);
  });

  it('a2 = 疾風 enter triggered with matcher (enterOrder=1) -> sleep choice', () => {
    const a2 = D11009.abilities[1];
    expect(a2.type).toBe('triggered');
    expect(a2.trigger?.hook).toBe('enter');
    expect(a2.trigger?.selfOnly).toBe(true);
    expect(typeof a2.trigger?.matcher).toBe('function');
    expect(a2.effect?.kind).toBe('choice');
  });

  it('a3 = hiramekiCharStun (icon-flash)', () => {
    const a3 = D11009.abilities[2];
    expect(a3.type).toBe('icon-flash');
    expect(a3.description).toMatch(/スリープ/);
  });

  it('D11010 variant shares abilities with D11009', () => {
    expect(D11010.abilities).toBe(D11009.abilities);
    expect(D11010.id).toBe('D11010');
    expect(D11010.imageUrl).not.toBe(D11009.imageUrl);
    expect(D11010.no).toBe('0939/D11010');
  });
});
