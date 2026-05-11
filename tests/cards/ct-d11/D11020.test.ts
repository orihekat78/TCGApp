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

  it('a1: sequence (sleep removal + conditional AP8000 removal)', () => {
    const a1 = D11020.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-hand');
    const eff = a1.effect as {
      kind: string;
      steps: ({ kind: string } | { kind: 'conditional'; if: { kind: string } })[];
    };
    expect(eff.kind).toBe('sequence');
    expect(eff.steps.length).toBe(2);
    expect(eff.steps[0].kind).toBe('choice');
    const cond = eff.steps[1] as { kind: 'conditional'; if: { kind: string; trait?: string; n?: number } };
    expect(cond.kind).toBe('conditional');
    expect(cond.if.kind).toBe('removeTraitAtLeast');
    expect(cond.if.trait).toBe('神奈川県警');
    expect(cond.if.n).toBe(3);
  });

  it('ruleRefs 非空', () => {
    expect(D11020.ruleRefs.length).toBeGreaterThan(0);
  });
});
