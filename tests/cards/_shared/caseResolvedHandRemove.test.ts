// tests/cards/_shared/caseResolvedHandRemove
// spec: .claude/specs/shared-classes/caseResolvedHandRemove.md

import { describe, it, expect } from 'vitest';
import { caseResolvedHandRemove } from '@/cards/_shared/caseResolvedHandRemove';
import { validate as effectValidate } from '@/engine/effect/validate';
import type { GameState } from '@/engine/types';

describe('caseResolvedHandRemove', () => {
  it('returns triggered AbilityDef with defaults', () => {
    const d = caseResolvedHandRemove();
    expect(d.id).toBe('a_case_resolved_handremove');
    expect(d.type).toBe('triggered');
    expect(d.scope).toBe('on-scene');
    expect(d.description).toMatch(/解決編になったとき/);
    expect(d.ruleRefs).toContain('rules/01-victory-conditions.md');
  });

  it('passes n / abilityId through', () => {
    const d = caseResolvedHandRemove({ n: 2, abilityId: 'a_x' });
    expect(d.id).toBe('a_x');
    expect(d.description).toMatch(/手札を2枚リムーブ/);
    const choice = d.effect as { options: { args: { target: { n: unknown } } }[] };
    expect(choice.options[0].args.target.n).toEqual({ min: 2, max: 2 });
  });

  it('trigger.hook is case:to-resolved and matcher detects self player', () => {
    const d = caseResolvedHandRemove();
    expect(d.trigger?.hook).toBe('case:to-resolved');
    const fakeState = {} as GameState;
    expect(d.trigger?.matcher?.({ player: 'self' }, fakeState)).toBe(true);
    expect(d.trigger?.matcher?.({ player: 'opp' }, fakeState)).toBe(false);
    expect(d.trigger?.matcher?.({}, fakeState)).toBe(false);
    expect(d.trigger?.matcher?.(null, fakeState)).toBe(false);
  });

  it('effect is choice of discard with pick from hand', () => {
    const d = caseResolvedHandRemove();
    expect(d.effect?.kind).toBe('choice');
    if (d.effect?.kind !== 'choice') throw new Error('expected choice');
    const atom = d.effect.options[0] as { kind: string; verb: string; args: { player: string; target: { kind: string; query: { area: string; side: string } } } };
    expect(atom.kind).toBe('atom');
    expect(atom.verb).toBe('discard');
    expect(atom.args.player).toBe('self');
    expect(atom.args.target.kind).toBe('pick');
    expect(atom.args.target.query.area).toBe('hand');
    expect(atom.args.target.query.side).toBe('self');
  });

  it('effect passes engine.effect.validate', () => {
    const d = caseResolvedHandRemove();
    const r = effectValidate(d.effect!);
    expect(r.ok).toBe(true);
  });
});
