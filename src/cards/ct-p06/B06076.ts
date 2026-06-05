// cards/ct-p06/B06076 ジェイムズ・ブラック (キャラ) — bounce batch #2 (a1 only)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【解決編】【登場時】相手の現場にいるレベル5以下のキャラを1枚まで選び、手札に移す。
//   【宣言】【スリープ】：相手は手札を1枚リムーブする。
//     この能力は相手の手札が4枚以上ある場合に宣言できる。
//
// a1: 【解決編】 enter + 相手 levelMax:5 1枚 sceneToHand
// a2: DEFERRED (custom condition: 相手手札 4 枚以上 — custom check が必要)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'caseStatus', status: '解決編' },
  effect: {
    kind: 'atom',
    verb: 'sceneToHand',
    args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 5 } },
  },
  description: '【解決編】【登場時】相手 level≤5 を1枚 bounce。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B06076: CardDef = {
  id: 'B06076',
  no: '0696/B06076',
  kind: 'character',
  names: ['ジェイムズ・ブラック'],
  colors: ['赤'],
  level: 6, ap: 5000, lp: 1,
  traits: ['FBI'], keywords: [],
  rarity: 'R',
  imageUrl: '1754285244546149.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
