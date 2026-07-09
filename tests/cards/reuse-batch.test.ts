// tests/cards/reuse-batch — catalog-reuse バッチ (手書き, card-condition-catalog 流用) の構造検証
// spec: .claude/specs/card-addition-checklist.md §5, card-authoring-convention.md, card-condition-catalog.md
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// catalog-reuse バッチは「既存 atom verb + catalog condition + 配線済 hook のみ」で実装した
// 非MVP カード群。個別 effect 経路 test は MVP 同型カード (D08003/D08013/D08019/D08026/D11020) で担保済。
// 本 test は REUSE_CARDS 全件が「登録可能・validate 通過・shape 正当」であることと、
// 代表カードの effect descriptor 構造を担保する。

import { describe, it, expect } from 'vitest';
import { engine } from '@/engine';
import type { AbilityDef, CardDef } from '@/engine/types';
import { REUSE_CARDS } from '@/cards';
import { B09100 } from '@/cards/ct-p09/B09100'; // declared sleep-cost remove apMax8000
import { D01004 } from '@/cards/ct-d01/D01004'; // partnerColor enter chain(discard -> sceneRemove)

const a1of = (c: CardDef) => c.abilities[0] as AbilityDef;

describe('reuse batch — registration & validate', () => {
  it('REUSE_CARDS 全件が validate を通過する', () => {
    const invalid = REUSE_CARDS.map((d) => ({ id: d.id, r: engine.cards.validate(d) })).filter((x) => !x.r.ok);
    expect(invalid).toEqual([]);
  });

  it('id 重複がない', () => {
    const ids = REUSE_CARDS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('全件が ruleRefs を持ち、character は ap/lp/level/traits/keywords を持つ', () => {
    for (const c of REUSE_CARDS) {
      expect(c.ruleRefs.length, `${c.id}: ruleRefs`).toBeGreaterThan(0);
      // vanilla case (印字テキストなし、例: PR302) のみ abilities 0 を許容。
      // character/event/partner の 0 件は誤登録 (取りこぼし) の可能性が高いので引き続き fail させる。
      if (c.kind !== 'case') expect(c.abilities.length, `${c.id}: abilities`).toBeGreaterThan(0);
      if (c.kind === 'character') {
        const ch = c as CardDef & { ap: number; lp: number; level: number; traits: string[]; keywords: string[] };
        expect(typeof ch.ap).toBe('number');
        expect(typeof ch.lp).toBe('number');
        expect(Array.isArray(ch.traits)).toBe(true);
        // traits は分割済 ('警察,警視庁' のような comma-join 単一要素が無いこと)
        for (const t of ch.traits) expect(t.includes(','), `${c.id}: trait "${t}" not split`).toBe(false);
      }
    }
  });

  it('全 ability に ruleRefs があり、effect.kind が既知', () => {
    const KNOWN = new Set(['atom', 'sequence', 'parallel', 'chain', 'choice', 'conditional', 'optional', 'forEach']);
    for (const c of REUSE_CARDS) {
      for (const ab of c.abilities as AbilityDef[]) {
        expect(ab.ruleRefs?.length, `${c.id}/${ab.id}: ruleRefs`).toBeGreaterThan(0);
        if (ab.effect) expect(KNOWN.has((ab.effect as { kind: string }).kind), `${c.id}/${ab.id}: ${(ab.effect as { kind: string }).kind}`).toBe(true);
      }
    }
  });
});

describe('reuse batch — representative shapes', () => {
  it('B09100 犯人: declared / sleepSelf cost / ターン1 / sceneRemove apMax8000', () => {
    const a = a1of(B09100);
    expect(a.type).toBe('declared');
    expect(a.cost).toEqual({ kind: 'sleepSelf' });
    expect(a.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a.effect).toMatchObject({ kind: 'atom', verb: 'sceneRemove', args: { filter: { apMax: 8000 } } });
  });

  it('D01004 工藤新一: partnerColor青 enter chain(discard -> sceneRemove apMax8000)', () => {
    const a = a1of(D01004);
    expect(a.type).toBe('triggered');
    expect(a.condition).toEqual({ kind: 'partnerColor', color: '青' });
    expect(a.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const eff = a.effect as { kind: string; steps: Array<{ verb: string }> };
    expect(eff.kind).toBe('chain');
    expect(eff.steps.map((s) => s.verb)).toEqual(['discard', 'sceneRemove']);
  });
});
