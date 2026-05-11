// tests/cards/registry — registerAll + cross-set registry テスト
// spec: Phase 5 Group C
// rules: 02-deck-construction.md

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerAll, ALL_CARDS } from '@/cards';

describe('cards/registerAll (Phase 5 Group C + D: 37 cards)', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
  });

  it('ALL_CARDS contains exactly 37 cards (Group C: 10 + Group D: 21)', () => {
    expect(ALL_CARDS.length).toBe(37);
  });

  it('registerAll() registers all 37 CardDefs to engine.cards', () => {
    expect(engine.cards.all().length).toBe(0);
    registerAll();
    expect(engine.cards.all().length).toBe(37);
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
    // All CT-D08 cards are blue
    expect(blueCards.length).toBe(26);
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

  it('registerAll() is idempotent (re-register overwrites, count stays 37)', () => {
    registerAll();
    expect(engine.cards.all().length).toBe(37);
    registerAll();
    expect(engine.cards.all().length).toBe(37);
  });
});
