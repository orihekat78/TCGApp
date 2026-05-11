// tests/cards/ct-d08/D08024
// spec: .claude/specs/cards-analysis/D08024.md

import { describe, it, expect } from 'vitest';
import { D08024 } from '@/cards/ct-d08/D08024';

describe('D08024 「あら…頼もしいじゃない…」 (event)', () => {
  it('shape: id, kind, names, colors, level', () => {
    expect(D08024.id).toBe('D08024');
    expect(D08024.no).toBe('0498/D08024');
    expect(D08024.kind).toBe('event');
    expect(D08024.names).toEqual(['「あら…頼もしいじゃない…」']);
    expect(D08024.colors).toEqual(['青']);
    expect(D08024.level).toBe(6);
    expect(D08024.rarity).toBe('D');
  });

  it('abilities[0] is custom sequence (sceneEnter + charModifyAP) — type triggered/on-hand', () => {
    const a1 = D08024.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-hand');
    expect(a1.trigger?.hook).toBe('effect:declared');
    expect(a1.effect?.kind).toBe('sequence');
  });

  it('abilities[1] is hiramekiDraw n=1 (icon-flash)', () => {
    const a2 = D08024.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('icon-flash');
    expect(a2.description).toMatch(/ヒラメキ/);
    expect(a2.description).toMatch(/1枚引く/);
  });

  it('ruleRefs 非空', () => {
    expect(D08024.ruleRefs.length).toBeGreaterThan(0);
  });
});
