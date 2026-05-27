// tests/cards/_shared/hiramekiDraw
// spec: .claude/specs/shared-classes/hiramekiDraw.md

import { describe, it, expect } from 'vitest';
import { hiramekiDraw } from '@/cards/_shared/hiramekiDraw';
import { validate as effectValidate } from '@/engine/effect/validate';

describe('hiramekiDraw', () => {
  it('returns icon-flash AbilityDef with defaults', () => {
    const d = hiramekiDraw();
    expect(d.id).toBe('a_flash_draw');
    expect(d.type).toBe('triggered');
    expect(d.trigger?.hook).toBe('evidence:remove-by-action');
    expect(d.trigger?.optional).toBe(true);
    expect(d.scope).toBe('on-evidence');
    expect(d.description).toBe('【ヒラメキ】カードを1枚引く。');
    expect(d.ruleRefs).toContain('rules/10-action-event.md');
    expect(d.ruleRefs).toContain('rules/14-refresh.md');
  });

  it('passes n / abilityId through', () => {
    const d = hiramekiDraw({ n: 2, abilityId: 'a_x' });
    expect(d.id).toBe('a_x');
    expect(d.description).toBe('【ヒラメキ】カードを2枚引く。');
  });

  it('effect has draw atom with player:self and n', () => {
    const d = hiramekiDraw({ n: 3 });
    expect(d.effect?.kind).toBe('atom');
    if (d.effect?.kind !== 'atom') throw new Error('expected atom');
    expect(d.effect.verb).toBe('draw');
    expect(d.effect.args).toEqual({ player: 'self', n: 3 });
  });

  it('effect passes engine.effect.validate', () => {
    const d = hiramekiDraw();
    const r = effectValidate(d.effect!);
    expect(r.ok).toBe(true);
  });
});
