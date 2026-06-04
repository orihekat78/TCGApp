// tests/cards/registry — registerAll + cross-set registry テスト
// spec: Phase 5 Group C
// rules: 02-deck-construction.md

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import {
  registerAll, ALL_CARDS,
  GENERATED_PARTNERS, GENERATED_SIMPLE_CARDS, GENERATED_COMPLEX_CUTINS,
} from '@/cards';

// MVP 47枚 (CT-D08:26青 + CT-D11:21黄) を baseline に、generator 出力分を加算して期待値を導出。
// generator 再実行で枚数が変わっても自動追従する一方、MVP 側の 47/26/21 が崩れれば検出される。
const GENERATED = [...GENERATED_PARTNERS, ...GENERATED_SIMPLE_CARDS, ...GENERATED_COMPLEX_CUTINS];
const GEN = GENERATED.length;
const GEN_BLUE = GENERATED.filter((c) => c.colors.includes('青')).length;
const GEN_YELLOW = GENERATED.filter((c) => c.colors.includes('黄')).length;

describe('cards/registerAll (Phase 5 MVP 47 + generated partners)', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
  });

  it('ALL_CARDS = MVP 47枚 + generated partners', () => {
    expect(ALL_CARDS.length).toBe(47 + GEN);
  });

  it('registerAll() registers all CardDefs to engine.cards', () => {
    expect(engine.cards.all().length).toBe(0);
    registerAll();
    expect(engine.cards.all().length).toBe(47 + GEN);
  });

  it('engine.cards.get returns each card by id (CT-D08 + CT-D11)', () => {
    registerAll();
    const ids = [
      'D08001', 'D08002', 'D08024', 'D08025', 'D08026',
      'D11001', 'D11002', 'D11019', 'D11020', 'D11021',
    ];
    for (const id of ids) {
      const def = engine.cards.get(id);
      expect(def, `engine.cards.get('${id}')`).toBeDefined();
      expect(def!.id).toBe(id);
    }
  });

  it('engine.cards.get(D08026) returns the case (caseLevel=7, traits=古城)', () => {
    registerAll();
    const d = engine.cards.get('D08026');
    expect(d).toBeDefined();
    expect(d!.kind).toBe('case');
    expect(d!.caseLevel).toBe(7);
    expect(d!.caseTraits).toEqual(['古城']);
  });

  it('byColor("青") returns CT-D08 cards (partners + characters + events + case)', () => {
    registerAll();
    const blueCards = engine.cards.byColor('青');
    const ids = blueCards.map(c => c.id);
    expect(ids).toContain('D08001');
    expect(ids).toContain('D08002');
    expect(ids).toContain('D08024');
    expect(ids).toContain('D08025');
    expect(ids).toContain('D08026');
    // Group D characters
    expect(ids).toContain('D08003');
    expect(ids).toContain('D08017');
    expect(ids).toContain('D08021');
    expect(ids).toContain('D08023');
    // MVP CT-D08 全26枚が青 + generator 由来の青パートナー
    expect(blueCards.length).toBe(26 + GEN_BLUE);
  });

  it('byColor("黄") returns CT-D11 cards', () => {
    registerAll();
    const yellowCards = engine.cards.byColor('黄');
    const ids = yellowCards.map(c => c.id);
    expect(ids).toContain('D11001');
    expect(ids).toContain('D11002');
    expect(ids).toContain('D11019');
    expect(ids).toContain('D11020');
    expect(ids).toContain('D11021');
    // Group E characters
    expect(ids).toContain('D11003');
    expect(ids).toContain('D11007');
    expect(ids).toContain('D11013');
    expect(ids).toContain('D11017');
    expect(ids).toContain('D11018');
    // MVP CT-D11 全21枚が黄 + generator 由来の黄パートナー
    expect(yellowCards.length).toBe(21 + GEN_YELLOW);
  });

  it('partners (D08001/D08002/D11001/D11002) have empty abilities', () => {
    registerAll();
    expect(engine.cards.get('D08001')!.abilities).toEqual([]);
    expect(engine.cards.get('D08002')!.abilities).toEqual([]);
    expect(engine.cards.get('D11001')!.abilities).toEqual([]);
    expect(engine.cards.get('D11002')!.abilities).toEqual([]);
  });

  it('cases (D08026/D11021) both have a1=caseResolvedHandRemove + a2=caseDeclaredEvidenceFlip', () => {
    registerAll();
    for (const id of ['D08026', 'D11021']) {
      const d = engine.cards.get(id)!;
      expect(d.kind).toBe('case');
      expect(d.abilities.length).toBe(2);
      expect(d.abilities[0].id).toBe('a1');
      expect(d.abilities[1].id).toBe('a2');
      expect(d.abilities[0].type).toBe('triggered');
      expect(d.abilities[1].type).toBe('declared');
    }
  });

  it('registerAll() is idempotent (re-register overwrites, count unchanged)', () => {
    registerAll();
    expect(engine.cards.all().length).toBe(47 + GEN);
    registerAll();
    expect(engine.cards.all().length).toBe(47 + GEN);
  });
});
