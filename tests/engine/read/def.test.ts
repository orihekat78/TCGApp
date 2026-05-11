import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { def, register, _resetRegistry } from '@/engine/read/def';
import type { CardDef } from '@/engine/types';

function makeDef(overrides: Partial<CardDef> = {}): CardDef {
  return {
    id: 'TEST001',
    no: 'B01001',
    kind: 'character',
    names: ['テストキャラ'],
    colors: ['青'],
    level: 3,
    ap: 3000,
    lp: 2,
    traits: ['少年探偵団'],
    rarity: 'U',
    isMR: false,
    imageUrl: 'https://example.com/test.jpg',
    abilities: [],
    ruleRefs: [],
    ...overrides,
  };
}

describe('engine.read.def', () => {
  beforeEach(() => { _resetRegistry(); });
  afterEach(() => { _resetRegistry(); });

  describe('card', () => {
    it('登録済みカードを id で取得できる', () => {
      register(makeDef({ id: 'CONAN001', no: 'B01001' }));
      const d = def.card('CONAN001');
      expect(d).toBeDefined();
      expect(d?.id).toBe('CONAN001');
      expect(d?.no).toBe('B01001');
    });

    it('未登録カードは undefined', () => {
      expect(def.card('NONEXISTENT')).toBeUndefined();
    });

    it('複数カードを登録して個別取得', () => {
      register(makeDef({ id: 'A001' }));
      register(makeDef({ id: 'B001' }));
      expect(def.card('A001')?.id).toBe('A001');
      expect(def.card('B001')?.id).toBe('B001');
    });

    it('同一 id で上書き登録される', () => {
      register(makeDef({ id: 'X001', ap: 1000 }));
      register(makeDef({ id: 'X001', ap: 5000 }));
      expect(def.card('X001')?.ap).toBe(5000);
    });
  });

  describe('byTrait', () => {
    it('特定の特徴を持つカードを取得', () => {
      register(makeDef({ id: 'A', traits: ['少年探偵団', '警察'] }));
      register(makeDef({ id: 'B', traits: ['警察'] }));
      register(makeDef({ id: 'C', traits: ['少年探偵団'] }));
      const result = def.byTrait('少年探偵団');
      expect(result).toHaveLength(2);
      expect(result.map(d => d.id)).toContain('A');
      expect(result.map(d => d.id)).toContain('C');
    });

    it('一致するカードがない場合は空配列', () => {
      register(makeDef({ id: 'A', traits: ['警察'] }));
      expect(def.byTrait('探偵')).toEqual([]);
    });

    it('レジストリが空の場合は空配列', () => {
      expect(def.byTrait('少年探偵団')).toEqual([]);
    });
  });

  describe('byColor', () => {
    it('特定の色を持つカードを取得', () => {
      register(makeDef({ id: 'A', colors: ['青', '赤'] }));
      register(makeDef({ id: 'B', colors: ['赤'] }));
      register(makeDef({ id: 'C', colors: ['青'] }));
      const result = def.byColor('青');
      expect(result).toHaveLength(2);
      expect(result.map(d => d.id)).toContain('A');
      expect(result.map(d => d.id)).toContain('C');
    });

    it('一致するカードがない場合は空配列', () => {
      register(makeDef({ id: 'A', colors: ['青'] }));
      expect(def.byColor('黄')).toEqual([]);
    });

    it('レジストリが空の場合は空配列', () => {
      expect(def.byColor('青')).toEqual([]);
    });
  });

  describe('register / _resetRegistry', () => {
    it('リセット後は空になる', () => {
      register(makeDef({ id: 'TEMP' }));
      expect(def.card('TEMP')).toBeDefined();
      _resetRegistry();
      expect(def.card('TEMP')).toBeUndefined();
    });
  });
});
