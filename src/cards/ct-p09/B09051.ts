// cards/ct-p09/B09051 ルパン (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【絆鈴木次郎吉】〚突撃［キャラ］〛（名乗り状態でもアクション［キャラ］できる）
//   【登場時】カードを1枚引く。
//
// a1: 常時有効 — 【絆鈴木次郎吉】の間〚突撃[キャラ]〛付与 (D09006 a2 同型 continuous, bond condition + grantKeywords)。
// a2: 【登場時】 カードを1枚引く (enter → draw / B02061 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【絆鈴木次郎吉】
  condition: { kind: 'bond', cardName: '鈴木次郎吉' },
  // 〚突撃[キャラ]〛を持つ
  continuousModifier: { grantKeywords: () => ['突撃[キャラ]'], printedKeywordWhenIconValid: true },
  description: '【絆鈴木次郎吉】〚突撃［キャラ］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【登場時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B09051: CardDef = {
  id: 'B09051',
  no: '0994/B09051',
  kind: 'character',
  names: ['ルパン'],
  colors: ['白'],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: ['犬'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608856214721.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
