// tests/cards/ct-d11/D11013
// spec: .claude/specs/cards-analysis/D11013.md

import { describe, it, expect } from 'vitest';
import { D11013 } from '@/cards/ct-d11/D11013';

describe('D11013 萩原千速 (cutin AP+1000 + 警察 draw)', () => {
  it('shape: id=D11013, level=2, ap=1000, lp=1, 黄, 警察|神奈川県警', () => {
    expect(D11013.id).toBe('D11013');
    expect(D11013.no).toBe('0940/D11013');
    expect(D11013.kind).toBe('character');
    expect(D11013.names).toEqual(['萩原千速']);
    expect(D11013.colors).toEqual(['黄']);
    expect(D11013.level).toBe(2);
    expect(D11013.ap).toBe(1000);
    expect(D11013.lp).toBe(1);
    expect(D11013.traits).toEqual(['警察', '神奈川県警']);
    expect(D11013.abilities.length).toBe(1);
  });

  it('a1 cutin with partnerColor 黄 condition + sequence effect', () => {
    const a1 = D11013.abilities[0];
    expect(a1.type).toBe('icon-cutin');
    expect(a1.scope).toBe('on-hand');
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '黄' });
    expect(a1.effect?.kind).toBe('sequence');
    expect(a1.description).toMatch(/警察/);
  });
});
