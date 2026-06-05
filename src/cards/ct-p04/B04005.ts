// cards/ct-p04/B04005 江戸川コナン (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【登場時】カードを2枚引き、手札を2枚リムーブする。
//   【宣言】【ターン1】このキャラ以外の〚特徴［毛利探偵事務所］〛のキャラを1枚まで選び、
//     ターン終了時までAP＋1000する。
//
// a1: 【登場時】sequence[draw 2, discard 2] (D08013 a1 同型)
// a2: 【宣言】【ターン1】このキャラ以外の[毛利探偵事務所]を1枚まで AP＋1000 (ターン終了まで) (D11021 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // カードを2枚引く
      { kind: 'atom', verb: 'draw',    args: { player: 'self', n: 2 } },
      // 手札を2枚リムーブする
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 2 } },
    ],
  },
  description: '【登場時】カードを2枚引き、手札を2枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // このキャラ以外の[毛利探偵事務所]のキャラを1枚まで選び、ターン終了時までAP＋1000する。
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
            query: { area: 'scene', side: 'either', filter: { trait: '毛利探偵事務所' }, excludeSelf: true },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description: '【宣言】【ターン1】このキャラ以外の[毛利探偵事務所]を1枚までターン終了時までAP＋1000。',
  ruleRefs: ['rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B04005: CardDef = {
  id: 'B04005',
  no: '0410/B04005',
  kind: 'character',
  names: ['江戸川コナン'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1735287656216870.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
