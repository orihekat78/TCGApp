// cards/pr-01/PR235 メアリー (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【登場時】手札から【赤】の〚特徴［赤井家］〛のキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
//
// a1: 【登場時】 enter trigger → chain (してもよい。そうした場合):
//     step1: 手札から【赤】[赤井家]を1枚までリムーブ (discard max:1, filter{color:赤, trait:赤井家}) — skip 時は chain break /
//     step2: カードを2枚引く (step1 実効果あり時のみ)。B08039 a1 / D08003 a1 chain 同型。

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
      // 手札から【赤】の[赤井家]のキャラを1枚リムーブしてもよい (max:1 で skip 可能、skip 時は chain break)
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { kind: 'character', color: '赤', trait: '赤井家' } } },
      // そうした場合、カードを2枚引く (step1 実効果あり時のみ)
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    ],
  },
  description:
    '【登場時】手札から【赤】の[赤井家]のキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const PR235: CardDef = {
  id: 'PR235',
  no: '0933/PR235',
  kind: 'character',
  names: ['メアリー'],
  colors: ['赤'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['赤井家'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1769159336084867.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
