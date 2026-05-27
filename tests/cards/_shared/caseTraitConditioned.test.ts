// tests/cards/_shared/caseTraitConditioned
// spec: .claude/specs/shared-classes/caseTraitConditioned.md

import { describe, it, expect } from 'vitest';
import { caseTraitConditioned } from '@/cards/_shared/caseTraitConditioned';
import { hiramekiDraw } from '@/cards/_shared/hiramekiDraw';
import { validate as effectValidate } from '@/engine/effect/validate';
import type { AbilityDef } from '@/engine/types';

describe('caseTraitConditioned', () => {
  it('wraps inner condition with caseTrait via AND when inner has one', () => {
    const inner: AbilityDef = {
      id: 'a1',
      type: 'triggered',
      condition: { kind: 'turn', player: 'self' },
      description: 'inner',
      ruleRefs: ['rules/15-abilities-effects.md'],
    };
    const d = caseTraitConditioned({ trait: '婚活', inner });
    expect(d.condition).toEqual({
      kind: 'and',
      cs: [
        { kind: 'caseTrait', trait: '婚活' },
        { kind: 'turn', player: 'self' },
      ],
    });
    expect(d.description).toBe('【事件婚活】inner');
    expect(d.ruleRefs).toContain('rules/17-icons.md');
    expect(d.ruleRefs).toContain('rules/15-abilities-effects.md');
  });

  it('sets bare caseTrait condition when inner has none', () => {
    const inner: AbilityDef = { id: 'a1', type: 'triggered', description: 'i' };
    const d = caseTraitConditioned({ trait: '古城', inner });
    expect(d.condition).toEqual({ kind: 'caseTrait', trait: '古城' });
  });

  it('preserves inner type/effect/limit and id (spread)', () => {
    const inner = hiramekiDraw({ n: 2, abilityId: 'a_inner' });
    const d = caseTraitConditioned({ trait: '婚活', inner });
    expect(d.id).toBe('a_inner');
    expect(d.type).toBe('triggered'); // 2026-05-27 Option C migration
    expect(d.effect).toEqual(inner.effect);
    expect(d.description).toMatch(/^【事件婚活】/);
  });

  it('dedupes ruleRefs when inner already includes rules/17-icons.md', () => {
    const inner: AbilityDef = {
      id: 'a',
      type: 'triggered',
      description: 'x',
      ruleRefs: ['rules/17-icons.md', 'rules/15-abilities-effects.md'],
    };
    const d = caseTraitConditioned({ trait: '婚活', inner });
    const count = d.ruleRefs!.filter(r => r === 'rules/17-icons.md').length;
    expect(count).toBe(1);
  });

  it('wrapped inner effect still passes engine.effect.validate', () => {
    const inner = hiramekiDraw({ n: 1 });
    const d = caseTraitConditioned({ trait: '婚活', inner });
    const r = effectValidate(d.effect!);
    expect(r.ok).toBe(true);
  });
});
