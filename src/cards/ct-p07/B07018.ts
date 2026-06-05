// cards/ct-p07/B07018 越水七槻 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【登場時】手札から〚特徴［探偵］〛のキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
//
// a1: 【登場時】(enter selfOnly) → chain「してもよい。そうした場合」semantics。
//     step1 = 手札の[探偵]を1枚までリムーブ (max:1 で skip 可 → skip 時 chain break)、
//     step2 = そうした場合 カードを2枚引く。D08003 a1 / D11007 a3 chain 同型。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札から[探偵]のキャラを1枚リムーブしてもよい (max:1 で skip 可能、skip 時は chain break)
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { trait: '探偵' } } },
      // そうした場合、カードを2枚引く
      { kind: 'atom', verb: 'draw',    args: { player: 'self', n: 2 } },
    ],
  },
  description: '【登場時】手札から[探偵]のキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B07018: CardDef = {
  id: 'B07018',
  no: '0750/B07018',
  kind: 'character',
  names: ['越水七槻'],
  colors: ['緑'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['探偵'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1762413976141181.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
