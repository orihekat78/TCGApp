// tests/cards/generated-batch — 非MVP 単純カード + 複雑カットイン generator 出力の構造検証
// spec: .claude/specs/card-addition-checklist.md §5, card-authoring-convention.md
// rules: 09-cutin-disguise.md, 13-keywords.md, 06-card-types.md
//
// 個別 effect 経路 test は MVP 同型カード (D08015/D08007/D11013) で担保済。本 test は
// generator 出力 213+36 枚が「登録可能・validate 通過・shape 正当」であることを担保する。

import { describe, it, expect } from 'vitest';
import { engine } from '@/engine';
import type { AbilityDef, CardDef } from '@/engine/types';
import { GENERATED_SIMPLE_CARDS, GENERATED_COMPLEX_CUTINS } from '@/cards';
import { B05010 } from '@/cards/ct-p05/B05010'; // monoColorDraw
import { B01098 } from '@/cards/ct-p01/B01098'; // removeAllContact
import { B03017 } from '@/cards/ct-p03/B03017'; // activateTrait
import { B09012 } from '@/cards/ct-p09/B09012'; // simple cut-in 自分ターン中 AP+3000
import { B03034 } from '@/cards/ct-p03/B03034'; // 旧 deferred stub → BUG-114 でカットイン実装済
import { PR287 } from '@/cards/pr-01/PR287'; // spread of D11013

const ALL_GEN = [...GENERATED_SIMPLE_CARDS, ...GENERATED_COMPLEX_CUTINS];
const a1of = (c: CardDef) => c.abilities[0] as AbilityDef;

describe('generated batch — registration & validate', () => {
  it('全 generated カードが validate を通過する', () => {
    const invalid = ALL_GEN
      .map((d) => ({ id: d.id, r: engine.cards.validate(d) }))
      .filter((x) => !x.r.ok);
    expect(invalid).toEqual([]);
  });

  it('cardId(=同一カード) 共有以外で id 重複がない', () => {
    const ids = ALL_GEN.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('generated simple cards — shape', () => {
  it('simple cut-in: 自分ターン中 AP+3000 (B09012)', () => {
    const a = a1of(B09012);
    expect(a.type).toBe('triggered');
    expect(a.scope).toBe('on-hand');
    expect(a.trigger).toMatchObject({ hook: 'effect:declared', optional: true, selfOnly: true });
    expect(a.condition).toEqual({ kind: 'turn', player: 'self' });
    expect(a.effect).toMatchObject({
      kind: 'atom', verb: 'charModifyAP',
      args: { uid: '$contact.byUid', delta: 3000, scope: 'contact' },
    });
  });

  it('case no-ability: kind=case / caseTraits=[] / abilities=[]', () => {
    const cases = GENERATED_SIMPLE_CARDS.filter((c) => c.kind === 'case');
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      expect(c.abilities).toEqual([]);
      expect((c as CardDef & { caseTraits: string[] }).caseTraits).toEqual([]);
      expect((c as CardDef & { caseLevel: number }).caseLevel).toBeGreaterThanOrEqual(6);
    }
  });

  it('keyword-only: continuous で grantKeywords を持つ (条件付き)', () => {
    const kwCards = GENERATED_SIMPLE_CARDS.filter(
      (c) => c.kind === 'character' && c.abilities.some((a) => (a as AbilityDef).type === 'continuous'),
    );
    expect(kwCards.length).toBeGreaterThan(0);
    for (const c of kwCards) {
      for (const a of c.abilities as AbilityDef[]) {
        expect(a.continuousModifier?.grantKeywords).toBeTypeOf('function');
        expect(a.condition).toBeDefined(); // 全 keyword-only は条件付き
      }
    }
  });
});

describe('generated complex cut-ins — shape', () => {
  it('monoColorDraw (B05010): partnerColor gate + AP+1000 + conditional draw', () => {
    const a = a1of(B05010);
    expect(a.condition).toEqual({ kind: 'partnerColor', color: '青' });
    const steps = (a.effect as { steps: unknown[] }).steps;
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ verb: 'charModifyAP', args: { delta: 1000 } });
    expect(steps[1]).toMatchObject({ kind: 'conditional', then: { verb: 'draw' } });
  });

  it('removeAllContact (B01098): turn:self + 2x sceneRemove ($contact.targetUid, $contact.byUid)', () => {
    const a = a1of(B01098);
    expect(a.condition).toEqual({ kind: 'turn', player: 'self' });
    const steps = (a.effect as { steps: Array<{ verb: string; args: { uid: string } }> }).steps;
    expect(steps.map((s) => s.verb)).toEqual(['sceneRemove', 'sceneRemove']);
    expect(steps.map((s) => s.args.uid)).toEqual(['$contact.targetUid', '$contact.byUid']);
  });

  it('activateTrait (B03017): turn:opp + sceneSetState active 短縮形', () => {
    const a = a1of(B03017);
    expect(a.condition).toEqual({ kind: 'turn', player: 'opp' });
    expect(a.effect).toMatchObject({
      kind: 'atom', verb: 'sceneSetState',
      args: { player: 'self', max: 1, state: 'active', filter: { trait: '少年探偵団' } },
    });
  });

  it('旧 deferred stub (B03034): BUG-114 で カットイン実装済 (abilities=1)', () => {
    // 2026-06-07: BUG-114 で 5 種の複雑カットインを全実装。B03034 はもう deferred stub ではない。
    expect(B03034.abilities.length).toBe(1);
    expect(B03034.abilities[0]!.trigger?.hook).toBe('effect:declared');
    expect(B03034.kind).toBe('character');
  });

  it('MVP spread (PR287) は D11013 の effect を継承する', () => {
    expect(PR287.id).toBe('PR287');
    expect(PR287.abilities.length).toBe(1);
    expect(a1of(PR287).condition).toEqual({ kind: 'partnerColor', color: '黄' });
  });
});
