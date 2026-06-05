// cards/ct-p01/B01088 黒田兵衛 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】【スリープ】〚手札を1枚リムーブする〛：このキャラ以外のレベル8以下の【黄】の
//     キャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定して
//     アクションできる）を与える。
//
// a1: 【宣言】【ターン1】 cost = sleepSelf + 手札1枚リム (pay で合成) /
//     effect = このキャラ以外のレベル8以下【黄】を1枚まで選び 突撃[キャラ] を ターン終了まで付与
//     (D02013 a1 cost / D08019 a2 $pick+明示 target 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 【スリープ】〚手札を1枚リムーブする〛 (両コストを pay で合成 / 一部でも払えなければ宣言不可)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    ],
  },
  // このキャラ以外のレベル8以下の【黄】のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$pick',
          kw: '突撃[キャラ]',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'either', filter: { color: '黄', levelMax: 8 }, excludeSelf: true },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description: '【宣言】【ターン1】【スリープ】〚手札を1枚リムーブ〛: このキャラ以外のレベル8以下【黄】を1枚までターン終了まで〚突撃［キャラ］〛付与。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B01088: CardDef = {
  id: 'B01088',
  no: '0076/B01088',
  kind: 'character',
  names: ['黒田兵衛'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013067543384.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
