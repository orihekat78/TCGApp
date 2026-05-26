// tests/cards/ct-d11/D11014
// spec: .claude/specs/cards-analysis/D11014.md

import { describe, it, expect } from 'vitest';
import { D11014 } from '@/cards/ct-d11/D11014';

describe('D11014 横溝重悟 (疾風 AP-1000 + 宣言 reanimate)', () => {
  it('shape: id, level=7, ap=6000, lp=1, 黄, 警察|神奈川県警', () => {
    expect(D11014.id).toBe('D11014');
    expect(D11014.no).toBe('0941/D11014');
    expect(D11014.level).toBe(7);
    expect(D11014.ap).toBe(6000);
    expect(D11014.lp).toBe(1);
    expect(D11014.abilities.length).toBe(2);
  });

  it('a1 = 疾風 enter triggered (matcherCondition: enterOrderEquals n=1) → AP-1000 短縮形', () => {
    const a1 = D11014.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('enter');
    // D11014 v2: matcher 関数 → matcherCondition declarative kind
    expect(a1.trigger?.matcher).toBeUndefined();
    expect(a1.trigger?.matcherCondition).toEqual({ kind: 'enterOrderEquals', n: 1 });
    // D11014 v2: choice + atom $pick + target pick → charModifyAP PA 短縮形
    const eff = a1.effect as { kind: string; verb?: string; args?: Record<string, unknown> };
    expect(eff.kind).toBe('atom');
    expect(eff.verb).toBe('charModifyAP');
    expect(eff.args?.max).toBe(1);
    expect(eff.args?.side).toBe('either');
    expect(eff.args?.delta).toBe(-1000);
    expect(eff.args?.scope).toBe('turn');
    expect(a1.description).toMatch(/AP/);
    expect(a1.description).toMatch(/1000/);
  });

  it('a2 = declared sleepSelf cost + effect sequence (discard modal → sceneEnter → 萩原千速 draw)', () => {
    const a2 = D11014.abilities[1];
    expect(a2.type).toBe('declared');
    // D11014 v2 (2nd fix 2026-05-25): cost を sleepSelf のみに簡素化。手札 1 リムは
    // effect step として D08013 同型 (modal pick)。auto-pick されないよう移動。
    expect(a2.cost?.kind).toBe('sleepSelf');
    expect(a2.effect?.kind).toBe('sequence');
    expect(a2.description).toMatch(/萩原千速/);
    const eff = a2.effect as { kind: string; steps: unknown[] };
    // step 1: discard (modal pick)
    const step1 = eff.steps[0] as { kind: string; verb: string; args: Record<string, unknown> };
    expect(step1.kind).toBe('atom');
    expect(step1.verb).toBe('discard');
    expect(step1.args.player).toBe('self');
    expect(step1.args.n).toBe(1);
    // step 3: conditional + boundMatchesFilter
    const condStep = eff.steps[2] as { kind: 'conditional'; if: { kind: string; bindKey?: string; filter?: Record<string, unknown> } };
    expect(condStep.kind).toBe('conditional');
    expect(condStep.if.kind).toBe('boundMatchesFilter');
    expect(condStep.if.bindKey).toBe('$entered');
    expect(condStep.if.filter).toEqual({ cardName: '萩原千速' });
  });
});
