// cards/ct-d09/D09006 諸伏高明 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【絆大和敢助】【自分ターン中】AP＋2000
//   自分のリムーブエリアに〚特徴［長野県警］〛のキャラが2枚以上ある場合、
//   このキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//
// a1: 常時有効 — 【絆大和敢助】かつ【自分ターン中】の間 AP＋2000 (D08005 a1 同型 continuous)
// a2: 常時有効 — リムーブの[長野県警]2枚以上で〚突撃〛付与 (D08021 a2 / D11007 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【絆大和敢助】かつ【自分ターン中】
  condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '大和敢助' }, { kind: 'turn', player: 'self' }] },
  // AP＋2000
  continuousModifier: { apDelta: 2000 },
  description: '【絆大和敢助】【自分ターン中】AP＋2000',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  // 自分のリムーブエリアに[長野県警]のキャラが2枚以上ある場合
  condition: { kind: 'removeTraitAtLeast', player: 'self', trait: '長野県警', n: 2 },
  // このキャラは〚突撃〛を持つ
  continuousModifier: { grantKeywords: () => ['突撃'] },
  description: '自分のリムーブエリアに[長野県警]が2枚以上ある場合、〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md'],
};

export const D09006: CardDef = {
  id: 'D09006',
  no: '0501/D09006',
  kind: 'character',
  names: ['諸伏高明'],
  colors: ['黄'],
  level: 7,
  ap: 5000,
  lp: 2,
  traits: ['警察', '長野県警'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743742875161480.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
