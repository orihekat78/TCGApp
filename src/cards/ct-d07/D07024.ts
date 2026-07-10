// cards/ct-d07/D07024 コードネーム・シェリー (case) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   自分の【黒】のパートナーの【事件解決】能力を以下の能力に書き換える。<br>【解決編】【証拠隠滅】【スリープ】〚証拠を事件レベルの数だけリムーブする〛：相手はゲームに敗北する。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  condition: {
    kind: 'partnerColor',
    color: '黒'
  },
  continuousModifier: {
    partnerSolveOverride: true
  },
  description: '自分の【黒】のパートナーの【事件解決】能力を以下の能力に書き換える。 【解決編】【証拠隠滅】【スリープ】〚証拠を事件レベルの数だけリムーブする〛：相手はゲームに敗北する。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md'
  ]
};

export const D07024: CardDef = {
  id: 'D07024',
  no: '0398/D07024',
  kind: 'case',
  names: [
    'コードネーム・シェリー'
  ],
  colors: [
    '黒'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'D',
  imageUrl: '1729865396264410.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
