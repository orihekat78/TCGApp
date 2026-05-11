// tests/cards/ct-d08/D08015
// spec: .claude/specs/cards-analysis/D08015.md

import { describe, it, expect } from 'vitest';
import { D08015 } from '@/cards/ct-d08/D08015';
import { D08016 } from '@/cards/ct-d08/D08016';

describe('D08015 小嶋元太 (character, enter draw+discard + cutinFixedAP)', () => {
  it('shape: id, kind, level=3, ap=2000, lp=1', () => {
    expect(D08015.id).toBe('D08015');
    expect(D08015.no).toBe('0495/D08015');
    expect(D08015.kind).toBe('character');
    expect(D08015.names).toEqual(['小嶋元太']);
    expect(D08015.colors).toEqual(['青']);
    expect(D08015.level).toBe(3);
    expect(D08015.ap).toBe(2000);
    expect(D08015.lp).toBe(1);
    expect(D08015.abilities.length).toBe(2);
  });

  it('a1: enter trigger (sequence: draw → discard)', () => {
    const a1 = D08015.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('enter');
    expect(a1.effect?.kind).toBe('sequence');
  });

  it('a2: cutinFixedAP delta=1000', () => {
    const a2 = D08015.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('icon-cutin');
    expect(a2.description).toMatch(/1000/);
  });

  it('D08016 variant shares abilities with D08015', () => {
    expect(D08016.abilities).toBe(D08015.abilities);
    expect(D08016.id).toBe('D08016');
    expect(D08016.imageUrl).not.toBe(D08015.imageUrl);
  });
});
