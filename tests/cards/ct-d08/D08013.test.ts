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

  it('a2: 【ヒラメキ】 inline declaration (draw 1) — 2026-05-27 factory 展開', () => {
    const a2 = D08013.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('triggered');
    expect(a2.trigger?.hook).toBe('evidence:remove-by-action');
    expect(a2.trigger?.optional).toBe(true);
    expect(a2.scope).toBe('on-evidence');
    expect(a2.description).toBe('【ヒラメキ】カードを1枚引く。');
    // inline 後: effect は kind:'atom' verb:'draw' args:{player:'self', n:1}
    const eff = a2.effect as { kind: string; verb?: string; args?: Record<string, unknown> };
    expect(eff.kind).toBe('atom');
    expect(eff.verb).toBe('draw');
    expect(eff.args).toEqual({ player: 'self', n: 1 });
    // 2026-05-27 Option C: type='triggered' + trigger:{hook,optional:true} 必須
    // (旧 icon-flash → triggered 統合により、trigger は定義必須に)
  });

  it('D08014 variant shares abilities with D08013', () => {
    expect(D08014.abilities).toBe(D08013.abilities);
    expect(D08014.id).toBe('D08014');
    expect(D08014.imageUrl).not.toBe(D08013.imageUrl);
  });
});
