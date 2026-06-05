// cards/ct-p07/B07074 ジョディ・スターリング (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【登場時】カードを1枚引き、手札を1枚リムーブする。
//   【宣言】〚手札を1枚リムーブする〛：キャラを1枚まで選び、ターン終了時までAP＋1000する。
//
// a1: triggered enter (selfOnly) — draw 1 → discard 1 (sequence、D08013 a1 同型)
// a2: declared — cost 手札1枚リム → キャラを1枚まで選び ターン終了まで AP＋1000 (D02013 a1 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  effect: {
    kind: 'sequence',
    steps: [
      // カードを1枚引き
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      // 手札を1枚リムーブする
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
  // 〚手札を1枚リムーブする〛
  cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  // キャラを1枚まで選び、ターン終了時までAP＋1000する
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          uid: '$pick',
          delta: 1000,
          scope: 'turn',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'either', filter: {} },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description: '【宣言】〚手札を1枚リムーブする〛: キャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/17-icons.md'],
};

export const B07074: CardDef = {
  id: 'B07074',
  no: '0803/B07074',
  kind: 'character',
  names: ['ジョディ・スターリング'],
  colors: ['赤'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['FBI'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414027312555.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
