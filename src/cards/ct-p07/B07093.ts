// cards/ct-p07/B07093 バーボン＆ライ (キャラ MR) — engine#2 charModifyLevel batch #2 (a2 only)
// rules: 15-abilities-effects.md, 17-icons.md, 18-mr.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー黒】【FILE7】【宣言】【ターン1】手札からレベル4以下の〚特徴［黒ずくめの組織］〛のキャラを
//     1枚まで登場させるか、自分のリムーブエリアにあるレベル4以下の〚特徴［黒ずくめの組織］〛のキャラを
//     1枚まで選び、登場させる。ターン終了時までそのキャラをAP＋4000し、〚突撃〛と「ターン終了時、
//     このキャラを現場からデッキの下に移す。」を与える。
//   【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。
//     この能力はパートナーエリアでも宣言できる。
//
// a1: DEFERRED (複合: hand/remove 2-source choice + multi-grant + turn-end-deck-bottom rider)
// a2: declared + turn1 limit + 相手 1pick で turn-level-1 (B05066/B07103 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'atom',
    verb: 'charModifyLevel',
    args: { player: 'self', max: 1, side: 'opp', delta: -1, scope: 'turn' },
  },
  description: '【宣言】【ターン1】相手の現場のキャラを1枚までレベル-1 (ターン終了時まで)。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B07093: CardDef = {
  id: 'B07093',
  no: '0820/B07093',
  kind: 'character',
  names: ['バーボン＆ライ', 'バーボン', 'ライ'],
  colors: ['黒'],
  level: 9, ap: 8000, lp: 2,
  traits: ['黒ずくめの組織'], keywords: [],
  rarity: 'MR',
  imageUrl: '1758249671523142.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/19-special-rules.md'],
};
