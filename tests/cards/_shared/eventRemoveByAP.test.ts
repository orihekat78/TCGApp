// tests/cards/_shared/eventRemoveByAP
// spec: .claude/specs/shared-classes/eventRemoveByAP.md

import { describe, it, expect } from 'vitest';
import { eventRemoveByAP } from '@/cards/_shared/eventRemoveByAP';
import { validate as effectValidate } from '@/engine/effect/validate';
import type { GameState } from '@/engine/types';

describe('eventRemoveByAP', () => {
  it('returns triggered AbilityDef with defaults', () => {
    const d = eventRemoveByAP({ apMax: 8000 });
    expect(d.id).toBe('a_event_remove_ap');
    expect(d.type).toBe('triggered');
    expect(d.scope).toBe('on-hand');
    expect(d.description).toBe('AP8000以下のキャラを1枚まで選び、リムーブする。');
    expect(d.ruleRefs).toContain('rules/15-abilities-effects.md');
    expect(d.ruleRefs).toContain('rules/19-special-rules.md');
  });

  it('trigger.hook is effect:declared and matcher detects event-use', () => {
    const d = eventRemoveByAP({ apMax: 5000 });
    expect(d.trigger?.hook).toBe('effect:declared');
    const fakeState = {} as GameState;
    expect(d.trigger?.matcher?.({ kind: 'event-use' }, fakeState)).toBe(true);
    expect(d.trigger?.matcher?.({ kind: 'declared-ability' }, fakeState)).toBe(false);
    expect(d.trigger?.matcher?.(null, fakeState)).toBe(false);
  });

  it('passes side / state / additionalCondition / abilityId through', () => {
    const extra = { kind: 'partnerColor', color: '青' } as const;
    const d = eventRemoveByAP({
      apMax: 6000,
      side: 'opp',
      state: ['sleep'],
      additionalCondition: extra,
      abilityId: 'a_x',
    });
    expect(d.id).toBe('a_x');
    expect(d.condition).toBe(extra);
    const atom = d.effect as { args: { side: string; state: unknown } };
    expect(atom.args.side).toBe('opp');
    expect(atom.args.state).toEqual(['sleep']);
  });

  it('effect is direct sceneRemove with cause:effect and apMax filter', () => {
    const d = eventRemoveByAP({ apMax: 8000 });
    const atom = d.effect as {
      kind: string;
      verb: string;
      args: { player: string; side: string; max: number; cause: string; filter: { apMax: number } };
    };
    expect(atom.kind).toBe('atom');
    expect(atom.verb).toBe('sceneRemove');
    expect(atom.args.player).toBe('self');
    expect(atom.args.side).toBe('either');
    expect(atom.args.max).toBe(1);
    expect(atom.args.cause).toBe('effect');
    expect(atom.args.filter).toEqual({ apMax: 8000 });
  });

  it('effect passes engine.effect.validate', () => {
    const d = eventRemoveByAP({ apMax: 9999 });
    const r = effectValidate(d.effect!);
    expect(r.ok).toBe(true);
  });
});
