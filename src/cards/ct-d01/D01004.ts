// cards/ct-d01/D01004 工藤新一 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【パートナー青】【登場時】手札を1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。
//
// a1: 【パートナー青】【登場時】手札1枚リムーブ (任意) → AP8000以下を1枚までリムーブ (D08003 a1 chain 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー青】
  condition: { kind: 'partnerColor', color: '青' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札を1枚リムーブしてもよい (max:1 で任意)
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      // そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする (step 1 applied 時のみ)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } } },
    ],
  },
  description: '【パートナー青】【登場時】手札を1枚リムーブしてもよい。そうした場合 AP8000以下を1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const D01004: CardDef = {
  id: 'D01004',
  no: '0093/D01004',
  kind: 'character',
  names: ['工藤新一'],
  colors: ['青'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013100402068.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};
