// tests/cards/ct-d08/D08013
// spec: .claude/specs/cards-analysis/D08013.md

import { describe, it, expect } from 'vitest';
import { D08013 } from '@/cards/ct-d08/D08013';
import { D08014 } from '@/cards/ct-d08/D08014';

describe('D08013 吉田歩美 (character, enter evidence manip + hiramekiDraw)', () => {
  it('shape: id, kind, level=4, ap=4000, lp=1', () => {
    expect(D08013.id).toBe('D08013');
    expect(D08013.no).toBe('0494/D08013');
    expect(D08013.kind).toBe('character');
    expect(D08013.names).toEqual(['吉田歩美']);
    expect(D08013.colors).toEqual(['青']);
    expect(D08013.level).toBe(4);
    expect(D08013.ap).toBe(4000);
    expect(D08013.lp).toBe(1);
    expect(D08013.abilities.length).toBe(2);
  });

  it('a1: enter trigger (sequence: evidenceGain → toHand → discard)', () => {
    const a1 = D08013.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('enter');
    expect(a1.trigger?.selfOnly).toBe(true);
    expect(a1.effect?.kind).toBe('sequence');
  });

  it('a2: hiramekiDraw n=1', () => {
    const a2 = D08013.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('icon-flash');
    expect(a2.description).toMatch(/1枚/);
  });

  it('D08014 variant shares abilities with D08013', () => {
    expect(D08014.abilities).toBe(D08013.abilities);
    expect(D08014.id).toBe('D08014');
    expect(D08014.imageUrl).not.toBe(D08013.imageUrl);
  });
});
