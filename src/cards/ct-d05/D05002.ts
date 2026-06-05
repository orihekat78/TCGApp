// cards/ct-d05/D05002 降谷零 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【パートナー黄】【登場時】手札を1枚リムーブしてもよい。そうした場合、
//     AP8000以下のキャラを1枚まで選び、リムーブする。
//
// a1: enter (パートナー黄) → chain(手札1枚リムーブ任意 → そうした場合 AP8000以下を1枚までリムーブ) — D08003 a1 chain 同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー黄】
  condition: { kind: 'partnerColor', color: '黄' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札を1枚リムーブしてもよい
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      // そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } },
    ],
  },
  description:
    '【パートナー黄】【登場時】手札を1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const D05002: CardDef = {
  id: 'D05002',
  no: '0147/D05002',
  kind: 'character',
  names: ['降谷零'],
  colors: ['黄'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['警察', '公安'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013167776620.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
