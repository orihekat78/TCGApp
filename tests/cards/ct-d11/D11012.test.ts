// tests/cards/ct-d11/D11012
// spec: .claude/specs/cards-analysis/D11012.md

import { describe, it, expect } from 'vitest';
import { D11012 } from '@/cards/ct-d11/D11012';

describe('D11012 横溝重悟 (宣言+ヒラメキ reanimate name)', () => {
  it('shape: id, level=4, ap=4000, lp=0, 黄, 警察|神奈川県警', () => {
    expect(D11012.id).toBe('D11012');
    expect(D11012.no).toBe('0466/D11012');
    expect(D11012.level).toBe(4);
    expect(D11012.ap).toBe(4000);
    expect(D11012.lp).toBe(0);
    expect(D11012.abilities.length).toBe(2);
  });

  it('a1 = declared selfToDeckBottom → choose LP+1 or AP+2000 for 警察 LP0', () => {
    const a1 = D11012.abilities[0];
    expect(a1.type).toBe('declared');
    expect(a1.cost?.kind).toBe('selfToDeckBottom');
    expect(a1.effect?.kind).toBe('choice');
    expect(a1.description).toMatch(/LP/);
    expect(a1.description).toMatch(/AP/);
  });

  it('a2 = icon-flash handAddFromRemove targeting 萩原千速', () => {
    const a2 = D11012.abilities[1];
    expect(a2.type).toBe('triggered');
    expect(a2.trigger?.hook).toBe('evidence:remove-by-action');
    expect(a2.trigger?.optional).toBe(true);
    expect(a2.scope).toBe('on-evidence');
    expect(a2.description).toMatch(/萩原千速/);
  });
});
