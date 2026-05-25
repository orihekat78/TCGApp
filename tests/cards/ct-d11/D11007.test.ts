// tests/cards/ct-d11/D11007
// spec: .claude/specs/cards-analysis/D11007.md

import { describe, it, expect } from 'vitest';
import { D11007 } from '@/cards/ct-d11/D11007';
import { D11008 } from '@/cards/ct-d11/D11008';

describe('D11007 松田陣平 (対象拡張 + partnerColor 突撃 + contact revenge)', () => {
  it('shape: id, level=6, ap=5000, lp=1, 黄, 警察|警視庁', () => {
    expect(D11007.id).toBe('D11007');
    expect(D11007.no).toBe('0938/D11007');
    expect(D11007.level).toBe(6);
    expect(D11007.ap).toBe(5000);
    expect(D11007.lp).toBe(1);
    expect(D11007.abilities.length).toBe(3);
  });

  it('a1 = trigger action:pre-target + expandActionTargets atom (D11007 v2 Phase 3)', () => {
    const a1 = D11007.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-scene');
    expect(a1.trigger?.hook).toBe('action:pre-target');
    expect(a1.trigger?.selfOnly).toBe(true);
    const eff = a1.effect as { kind: string; verb: string; args: Record<string, unknown> };
    expect(eff.kind).toBe('atom');
    expect(eff.verb).toBe('expandActionTargets');
    expect(eff.args.side).toBe('opp');
    expect(eff.args.state).toEqual(['active']);
    expect(eff.args.levelMin).toBe(7);
    // customSelectorPatch (旧 stub) は撤去
    expect(a1.continuousModifier).toBeUndefined();
  });

  it('a2 = partnerColor 黄 突撃 (continuous)', () => {
    const a2 = D11007.abilities[1];
    expect(a2.type).toBe('continuous');
    expect(a2.description).toMatch(/突撃/);
  });

  it('a3 = triggered contact:start, limit turn 1, chain (discard max:1 → AP+3000)', () => {
    const a3 = D11007.abilities[2];
    expect(a3.type).toBe('triggered');
    expect(a3.trigger?.hook).toBe('contact:start');
    expect(a3.limit).toEqual({ kind: 'turn', n: 1 });
    expect(a3.condition).toEqual({ kind: 'turn', player: 'self' });
    // D11007 v2 Phase 2: matcher 関数 → matcherCondition declarative kind
    expect(a3.trigger?.matcher).toBeUndefined();
    expect(a3.trigger?.matcherCondition).toEqual({ kind: 'contactOpponentApHigher' });
    // D11007 v2 fix: optional 撤去 (UI 未配線で常に skip される) → chain + max:1 で「してもよい」表現 (D08003 a1 同型)
    const eff = a3.effect as { kind?: string; steps?: { verb?: string; args?: Record<string, unknown> }[] };
    expect(eff.kind).toBe('chain');
    expect(eff.steps?.length).toBe(2);
    expect(eff.steps?.[0]?.verb).toBe('discard');
    expect(eff.steps?.[0]?.args?.max).toBe(1); // 「してもよい」= max:1 で skip 可能
    expect(eff.steps?.[1]?.verb).toBe('charModifyAP');
  });

  it('D11008 variant shares abilities with D11007', () => {
    expect(D11008.abilities).toBe(D11007.abilities);
    expect(D11008.id).toBe('D11008');
    expect(D11008.imageUrl).not.toBe(D11007.imageUrl);
  });
});
