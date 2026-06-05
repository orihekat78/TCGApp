// cards/ct-d02/D02002 服部平次 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【パートナー緑】【登場時】手札を1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。
//
// a1: enter trigger (partnerColor 緑) → chain[ 手札1枚までリム(任意) → そうした場合 AP8000以下を1枚までリム ] — D08003 a1 同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー緑】
  condition: { kind: 'partnerColor', color: '緑' },
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
    '【パートナー緑】【登場時】手札を1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const D02002: CardDef = {
  id: 'D02002',
  no: '0105/D02002',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013100444205.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
