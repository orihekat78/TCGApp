// tests/cards/ct-d08/D08007
// spec: .claude/specs/cards-analysis/D08007.md

import { describe, it, expect } from 'vitest';
import { D08007 } from '@/cards/ct-d08/D08007';
import { D08008 } from '@/cards/ct-d08/D08008';

describe('D08007 吉田歩美 (character, cutin trait scaling AP)', () => {
  it('shape: id, kind, level=2, ap=1000, lp=1', () => {
    expect(D08007.id).toBe('D08007');
    expect(D08007.no).toBe('0491/D08007');
    expect(D08007.kind).toBe('character');
    expect(D08007.names).toEqual(['吉田歩美']);
    expect(D08007.colors).toEqual(['青']);
    expect(D08007.level).toBe(2);
    expect(D08007.ap).toBe(1000);
    expect(D08007.lp).toBe(1);
    expect(D08007.abilities.length).toBe(1);
  });

  it('a1: icon-cutin, 自分ターン中, delta via $dyn expression', () => {
    const a1 = D08007.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('icon-cutin');
    expect(a1.condition).toEqual({ kind: 'turn', player: 'self' });
    const eff = a1.effect as { kind: string; verb: string; args: { delta: string } };
    expect(eff.kind).toBe('atom');
    expect(eff.verb).toBe('charModifyAP');
    expect(typeof eff.args.delta).toBe('string');
    expect(eff.args.delta).toMatch(/\$dyn/);
  });

  it('D08008 variant shares abilities with D08007', () => {
    expect(D08008.abilities).toBe(D08007.abilities);
    expect(D08008.id).toBe('D08008');
    expect(D08008.imageUrl).not.toBe(D08007.imageUrl);
  });
});
