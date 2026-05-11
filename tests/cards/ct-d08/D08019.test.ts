// tests/cards/ct-d08/D08019
// spec: .claude/specs/cards-analysis/D08019.md

import { describe, it, expect } from 'vitest';
import { D08019 } from '@/cards/ct-d08/D08019';
import { D08020 } from '@/cards/ct-d08/D08020';

describe('D08019 阿笠博士 (character, 解決編enter sleep + hiramekiCharStun)', () => {
  it('shape: id, kind, level=5, ap=5000, lp=1, trait=発明家', () => {
    expect(D08019.id).toBe('D08019');
    expect(D08019.no).toBe('0497/D08019');
    expect(D08019.kind).toBe('character');
    expect(D08019.names).toEqual(['阿笠博士']);
    expect(D08019.colors).toEqual(['青']);
    expect(D08019.level).toBe(5);
    expect(D08019.ap).toBe(5000);
    expect(D08019.lp).toBe(1);
    expect(D08019.traits).toEqual(['発明家']);
    expect(D08019.abilities.length).toBe(2);
  });

  it('a1: enter trigger with 解決編 condition + sceneHas guard', () => {
    const a1 = D08019.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.condition).toEqual({ kind: 'caseStatus', status: '解決編' });
    expect(a1.trigger?.hook).toBe('enter');
    expect(a1.effect?.kind).toBe('conditional');
  });

  it('a2: hiramekiCharStun (icon-flash)', () => {
    const a2 = D08019.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('icon-flash');
    expect(a2.description).toMatch(/スリープ/);
  });

  it('D08020 variant shares abilities with D08019', () => {
    expect(D08020.abilities).toBe(D08019.abilities);
    expect(D08020.id).toBe('D08020');
    expect(D08020.imageUrl).not.toBe(D08019.imageUrl);
  });
});
