// tests/cards/ct-d11/D11019
// spec: .claude/specs/cards-analysis/D11019.md

import { describe, it, expect } from 'vitest';
import { D11019 } from '@/cards/ct-d11/D11019';

describe('D11019 15の受難 (event)', () => {
  it('shape: id, kind, names, colors=黄, level=4', () => {
    expect(D11019.id).toBe('D11019');
    expect(D11019.no).toBe('0944/D11019');
    expect(D11019.kind).toBe('event');
    expect(D11019.names).toEqual(['15の受難']);
    expect(D11019.colors).toEqual(['黄']);
    expect(D11019.level).toBe(4);
  });

  it('a1 is triggered sequence with deckRevealUntil', () => {
    const a1 = D11019.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-hand');
    expect(a1.trigger?.hook).toBe('effect:declared');
    const eff = a1.effect as { kind: string; steps: { kind: string; verb?: string }[] };
    expect(eff.kind).toBe('sequence');
    expect(eff.steps[0].kind).toBe('atom');
    expect(eff.steps[0].verb).toBe('deckRevealUntil');
  });

  it('a2 is cutinFixedAP delta=1000 (icon-cutin)', () => {
    const a2 = D11019.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('icon-cutin');
    expect(a2.description).toMatch(/カットイン.*AP/);
    expect(a2.description).toMatch(/1000/);
  });

  it('ruleRefs 非空', () => {
    expect(D11019.ruleRefs.length).toBeGreaterThan(0);
  });
});
