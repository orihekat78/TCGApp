// cards/ct-p06/B06108 漆黒の特急 (case) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/13-keywords.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   この事件が解決編になったとき、相手はカードを1枚引く。\n自分の【黒】のパートナーの【事件解決】能力を以下の能力に書き換える。\n【解決編】【証拠隠滅】【スリープ】〚証拠を事件レベルの数だけリムーブする〛：相手はゲームに敗北する。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always',
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true
  },
  effect: {
    args: {
      n: 1,
      player: 'opp'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: 'この事件が解決編になったとき、相手はカードを1枚引く。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'always',
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
    'rules/13-keywords.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B06108: CardDef = {
  id: 'B06108',
  no: '0725/B06108',
  kind: 'case',
  names: [
    '漆黒の特急'
  ],
  colors: [
    '白',
    '黒'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'C',
  imageUrl: '1754285264417147.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/13-keywords.md',
    'rules/21-declared-ability-cost.md'
  ],
};
