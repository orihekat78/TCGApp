// tests/cards/ct-d11/D11020
// spec: .claude/specs/cards-analysis/D11020.md

import { describe, it, expect } from 'vitest';
import { D11020 } from '@/cards/ct-d11/D11020';

describe('D11020 18の想起 (event)', () => {
  it('shape: id, kind, colors=黄, level=8', () => {
    expect(D11020.id).toBe('D11020');
    expect(D11020.no).toBe('0945/D11020');
    expect(D11020.kind).toBe('event');
    expect(D11020.names).toEqual(['18の想起']);
    expect(D11020.colors).toEqual(['黄']);
    expect(D11020.level).toBe(8);
  });

  it('a1: sequence (sceneRemove sleep + conditional sceneRemove AP8000) — D08003 短縮形 pattern', () => {
    const a1 = D11020.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-hand');
    const eff = a1.effect as {
      kind: string;
      steps: ({ kind: string; verb?: string; args?: Record<string, unknown> }
            | { kind: 'conditional'; if: { kind: string } })[];
    };
    expect(eff.kind).toBe('sequence');
    expect(eff.steps.length).toBe(2);
    // step 1: sceneRemove 短縮形 (max:1, side: either, filter: levelMax:7, state:['sleep'])
    const step1 = eff.steps[0] as { kind: string; verb: string; args: Record<string, unknown> };
    expect(step1.kind).toBe('atom');
    expect(step1.verb).toBe('sceneRemove');
    expect(step1.args.max).toBe(1);
    expect(step1.args.side).toBe('either');
    expect(step1.args.filter).toEqual({ levelMax: 7 });
    expect(step1.args.state).toEqual(['sleep']);
    // step 2: conditional + sceneRemove 短縮形
    const cond = eff.steps[1] as { kind: 'conditional'; if: { kind: string; trait?: string; n?: number }; then: { kind: string; verb: string; args: Record<string, unknown> } };
    expect(cond.kind).toBe('conditional');
    expect(cond.if.kind).toBe('removeTraitAtLeast');
    expect(cond.if.trait).toBe('神奈川県警');
    expect(cond.if.n).toBe(3);
    expect(cond.then.kind).toBe('atom');
    expect(cond.then.verb).toBe('sceneRemove');
    expect(cond.then.args.max).toBe(1);
    expect(cond.then.args.side).toBe('either');
    expect(cond.then.args.filter).toEqual({ apMax: 8000 });
  });

  it('ruleRefs 非空', () => {
    expect(D11020.ruleRefs.length).toBeGreaterThan(0);
  });
});
