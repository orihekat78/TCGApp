// engine.cards.* — registry namespace tests
// spec: .claude/specs/engine-api-card-shape.md

import { describe, it, expect, beforeEach } from 'vitest';
import { cards } from '@/engine/cards';
import type { CardDef } from '@/engine/types';

function makeChar(id: string, names: string[], colors: string[] = ['青'], traits: string[] = []): CardDef {
  return {
    id,
    no: `0001/${id}`,
    kind: 'character',
    names,
    colors,
    level: 5,
    ap: 5000,
    lp: 1,
    traits,
    rarity: 'D',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    keywords: [],
  };
}

describe('engine.cards.* registry namespace', () => {
  beforeEach(() => {
    cards._resetRegistry();
  });

  it('register + get round-trip', () => {
    const def = makeChar('D08003', ['江戸川コナン']);
    cards.register(def);
    const got = cards.get('D08003');
    expect(got).toBeDefined();
    expect(got?.id).toBe('D08003');
    expect(got?.names).toEqual(['江戸川コナン']);
  });

  it('all() returns the registered count', () => {
    cards.register(makeChar('A1', ['Alpha']));
    cards.register(makeChar('A2', ['Beta']));
    cards.register(makeChar('A3', ['Gamma']));
    expect(cards.all()).toHaveLength(3);
  });

  it('byName matches split-name (rules/19)', () => {
    // 複数名カード: names 配列に分割名を全て持つ
    const merged = makeChar('B05005P', ['江戸川コナン&工藤新一', '江戸川コナン', '工藤新一']);
    const conan = makeChar('D08003', ['江戸川コナン']);
    cards.register(merged);
    cards.register(conan);
    // 「江戸川コナン」で検索 → 両方マッチ
    const matched = cards.byName('江戸川コナン');
    expect(matched).toHaveLength(2);
    expect(matched.map(d => d.id).sort()).toEqual(['B05005P', 'D08003']);
    // 「工藤新一」で検索 → 分割名マッチで1件
    expect(cards.byName('工藤新一').map(d => d.id)).toEqual(['B05005P']);
  });

  it('byTrait delegates correctly', () => {
    const a = makeChar('A1', ['Alpha'], ['青'], ['探偵']);
    const b = makeChar('A2', ['Beta'], ['青'], ['警察']);
    const c = makeChar('A3', ['Gamma'], ['青'], ['探偵', '少年探偵団']);
    cards.register(a);
    cards.register(b);
    cards.register(c);
    expect(cards.byTrait('探偵').map(d => d.id).sort()).toEqual(['A1', 'A3']);
    expect(cards.byTrait('警察').map(d => d.id)).toEqual(['A2']);
    expect(cards.byTrait('少年探偵団').map(d => d.id)).toEqual(['A3']);
  });

  it('byColor delegates correctly', () => {
    cards.register(makeChar('A1', ['Alpha'], ['青']));
    cards.register(makeChar('A2', ['Beta'], ['赤']));
    cards.register(makeChar('A3', ['Gamma'], ['青', '赤']));
    expect(cards.byColor('青').map(d => d.id).sort()).toEqual(['A1', 'A3']);
    expect(cards.byColor('赤').map(d => d.id).sort()).toEqual(['A2', 'A3']);
  });

  it('validate(def) succeeds for a clean def', () => {
    const def = makeChar('A1', ['Alpha']);
    def.ruleRefs = []; // empty avoids file-existence check
    const r = cards.validate(def);
    expect(r.ok).toBe(true);
  });

  it('validate(def) flags duplicate ability ids', () => {
    const def = makeChar('A1', ['Alpha']);
    def.abilities = [
      {
        id: 'a1',
        type: 'declared',
        description: 'first',
        effect: { kind: 'atom', verb: 'noop', args: {} },
      },
      {
        id: 'a1', // duplicate
        type: 'declared',
        description: 'dup',
        effect: { kind: 'atom', verb: 'noop', args: {} },
      },
    ];
    const r = cards.validate(def);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join('\n')).toMatch(/duplicate ability id/);
    }
  });

  it('validateAll returns per-def results', () => {
    cards.register(makeChar('A1', ['Alpha']));
    cards.register(makeChar('A2', ['Beta']));
    const results = cards.validateAll();
    expect(results).toHaveLength(2);
    expect(results.every(r => r.ok)).toBe(true);
  });

  it('_resetRegistry clears all registered defs', () => {
    cards.register(makeChar('A1', ['Alpha']));
    cards.register(makeChar('A2', ['Beta']));
    expect(cards.all()).toHaveLength(2);
    cards._resetRegistry();
    expect(cards.all()).toHaveLength(0);
    expect(cards.get('A1')).toBeUndefined();
  });

  it('register overwrites same id (Map semantics)', () => {
    cards.register(makeChar('A1', ['First']));
    cards.register(makeChar('A1', ['Second']));
    expect(cards.all()).toHaveLength(1);
    expect(cards.get('A1')?.names).toEqual(['Second']);
  });
});
