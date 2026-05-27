// tests/cards/_shared/hiramekiCharStun
// spec: .claude/specs/shared-classes/hiramekiCharStun.md

import { describe, it, expect } from 'vitest';
import { hiramekiCharStun } from '@/cards/_shared/hiramekiCharStun';
import { validate as effectValidate } from '@/engine/effect/validate';

describe('hiramekiCharStun', () => {
  it('returns icon-flash AbilityDef with default abilityId', () => {
    const d = hiramekiCharStun();
    expect(d.id).toBe('a_flash_stun');
    expect(d.type).toBe('triggered');
    expect(d.trigger?.hook).toBe('evidence:remove-by-action');
    expect(d.trigger?.optional).toBe(true);
    expect(d.scope).toBe('on-evidence');
    expect(d.description).toMatch(/ヒラメキ/);
    expect(d.ruleRefs!.length).toBeGreaterThan(0);
  });

  it('passes opts through (side / n / abilityId)', () => {
    const d = hiramekiCharStun({ side: 'opp', n: { min: 1, max: 1 }, abilityId: 'a_h' });
    expect(d.id).toBe('a_h');
    const choice = d.effect as { kind: 'choice'; options: unknown[] };
    const atom = choice.options[0] as { args: { target: { query: { side: string }; n: unknown } } };
    expect(atom.args.target.query.side).toBe('opp');
    expect(atom.args.target.n).toEqual({ min: 1, max: 1 });
  });

  it('effect is choice of sceneSetState with state:sleep', () => {
    const d = hiramekiCharStun();
    expect(d.effect?.kind).toBe('choice');
    if (d.effect?.kind !== 'choice') throw new Error('expected choice');
    expect(d.effect.chooser).toBe('self');
    const atom = d.effect.options[0] as { kind: string; verb: string; args: { state: string; uid: string } };
    expect(atom.kind).toBe('atom');
    expect(atom.verb).toBe('sceneSetState');
    expect(atom.args.state).toBe('sleep');
    expect(atom.args.uid).toBe('$pick');
  });

  it('default target n = {min:0, max:1}, side either', () => {
    const d = hiramekiCharStun();
    const choice = d.effect as { options: unknown[] };
    const atom = choice.options[0] as {
      args: { target: { kind: string; query: { area: string; side: string }; n: { min: number; max: number }; chooser: string } };
    };
    expect(atom.args.target.kind).toBe('pick');
    expect(atom.args.target.query.area).toBe('scene');
    expect(atom.args.target.query.side).toBe('either');
    expect(atom.args.target.n).toEqual({ min: 0, max: 1 });
    expect(atom.args.target.chooser).toBe('self');
  });

  it('effect passes engine.effect.validate', () => {
    const d = hiramekiCharStun();
    const r = effectValidate(d.effect!);
    expect(r.ok).toBe(true);
  });
});
