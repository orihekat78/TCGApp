// cards/ct-p07/B07103 バーボン (キャラ) — engine-extension #2 batch (charModifyLevel)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【登場時】カードを1枚引き、手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。
//
// a1: enter selfOnly chain (draw1 → discard1) — D08013 a1 同型
// a2: 解決編 + declared + turn1 limit, side:opp 1pick で charModifyLevel -1 turn-scope (engine拡張#2 verb 利用)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw',    args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【登場時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' }, // 【解決編】
  limit: { kind: 'turn', n: 1 },                       // 【ターン1】
  // 相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル-1する
  effect: {
    kind: 'atom',
    verb: 'charModifyLevel',
    args: { player: 'self', max: 1, side: 'opp', delta: -1, scope: 'turn' },
  },
  description: '【解決編】【宣言】【ターン1】相手の現場のキャラを1枚までレベル-1 (ターン終了時まで)。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B07103: CardDef = {
  id: 'B07103',
  no: '0830/B07103',
  kind: 'character',
  names: ['バーボン'],
  colors: ['黒'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414041049076.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
