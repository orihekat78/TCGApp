// engine.read.keyword — defHasKeyword / abilityIsCutin / abilityIsHirameki (BUG-122)
// アイコン能力 (カットイン/変装/ヒラメキ/ミスリード) は keywords[] ではなく ability 構造で表現される。

import { describe, it, expect } from 'vitest';
import { defHasKeyword, abilityIsCutin, abilityIsHirameki } from '@/engine/read/keyword';
import type { CardDef, AbilityDef } from '@/engine/types';

function defOf(overrides: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: overrides.id,
    no: 'NO',
    kind: 'character',
    names: ['x'],
    colors: [],
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...overrides,
  };
}

const cutin: AbilityDef = {
  id: 'cut', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true }, description: 'カットイン',
};
const hirameki: AbilityDef = {
  id: 'hir', type: 'triggered',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, description: 'ヒラメキ',
};
const disguise: AbilityDef = { id: 'dis', type: 'icon-disguise', description: '変装' };
const misread: AbilityDef = { id: 'mis', type: 'icon-misread', description: 'ミスリード' };

describe('engine.read.keyword.defHasKeyword', () => {
  it('matches normal keyword via keywords[]', () => {
    expect(defHasKeyword(defOf({ id: 'A', keywords: ['迅速'] }), '迅速')).toBe(true);
    expect(defHasKeyword(defOf({ id: 'A', keywords: ['迅速'] }), '突撃')).toBe(false);
  });

  it('matches カットイン via ability (not keywords[])', () => {
    const d = defOf({ id: 'A', keywords: [], abilities: [cutin] });
    expect(defHasKeyword(d, 'カットイン')).toBe(true);
    expect(defHasKeyword(defOf({ id: 'B', keywords: [] }), 'カットイン')).toBe(false);
  });

  it('matches 変装 / ヒラメキ / ミスリード via ability', () => {
    expect(defHasKeyword(defOf({ id: 'A', abilities: [disguise] }), '変装')).toBe(true);
    expect(defHasKeyword(defOf({ id: 'B', abilities: [hirameki] }), 'ヒラメキ')).toBe(true);
    expect(defHasKeyword(defOf({ id: 'C', abilities: [misread] }), 'ミスリード')).toBe(true);
    expect(defHasKeyword(defOf({ id: 'D', abilities: [cutin] }), '変装')).toBe(false);
  });

  it('returns false for undefined def', () => {
    expect(defHasKeyword(undefined, 'カットイン')).toBe(false);
  });

  it('abilityIsCutin / abilityIsHirameki predicates', () => {
    expect(abilityIsCutin(cutin)).toBe(true);
    expect(abilityIsCutin(hirameki)).toBe(false);
    expect(abilityIsHirameki(hirameki)).toBe(true);
    expect(abilityIsHirameki(cutin)).toBe(false);
  });
});
