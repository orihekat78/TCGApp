// tests/cards/_shared/cutinFixedAP
// spec: .claude/specs/shared-classes/cutinFixedAP.md

import { describe, it, expect } from 'vitest';
import { cutinFixedAP } from '@/cards/_shared/cutinFixedAP';
import { validate as effectValidate } from '@/engine/effect/validate';

describe('cutinFixedAP', () => {
  it('returns icon-cutin AbilityDef with default abilityId', () => {
    const d = cutinFixedAP({ delta: 1000 });
    expect(d.id).toBe('a_cutin_ap');
    expect(d.type).toBe('triggered');
    expect(d.trigger?.hook).toBe('effect:declared');
    expect(d.trigger?.optional).toBe(true);
    expect(d.trigger?.selfOnly).toBe(true);
    expect(d.scope).toBe('on-hand');
    expect(d.description).toBe('【カットイン】AP＋1000');
    expect(d.ruleRefs!.length).toBeGreaterThan(0);
  });

  it('passes abilityId/additionalCondition through', () => {
    const extra = { kind: 'turn', player: 'self' } as const;
    const d = cutinFixedAP({ delta: 2000, abilityId: 'a_x', additionalCondition: extra });
    expect(d.id).toBe('a_x');
    expect(d.condition).toBe(extra);
    expect(d.description).toBe('【カットイン】AP＋2000');
  });

  it('formats negative delta with minus sign', () => {
    const d = cutinFixedAP({ delta: -1000 });
    expect(d.description).toBe('【カットイン】AP－1000');
  });

  it('effect has charModifyAP atom with $contact.byUid, delta, scope:contact', () => {
    const d = cutinFixedAP({ delta: 1500 });
    expect(d.effect?.kind).toBe('atom');
    if (d.effect?.kind !== 'atom') throw new Error('expected atom');
    expect(d.effect.verb).toBe('charModifyAP');
    const args = d.effect.args as { uid: string; delta: number; scope: string };
    expect(args.uid).toBe('$contact.byUid');
    expect(args.delta).toBe(1500);
    expect(args.scope).toBe('contact');
  });

  it('effect passes engine.effect.validate', () => {
    const d = cutinFixedAP({ delta: 2000 });
    const r = effectValidate(d.effect!);
    expect(r.ok).toBe(true);
  });
});
