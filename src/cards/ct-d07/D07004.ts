// cards/ct-d07/D07004 ジン (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【パートナー黒】【登場時】手札を1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。
//
// a1: enter hook (selfOnly) + condition partnerColor(黒) + chain。
//     step1: 手札を1枚リムーブ (してもよい)。step2: step1 適用時のみ AP8000以下を1枚までリムーブ。D08003 a1 同型。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー黒】
  condition: { kind: 'partnerColor', color: '黒' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札を1枚リムーブしてもよい
      { kind: 'atom', verb: 'discard',     args: { player: 'self', max: 1 } },
      // そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする (step1 適用時のみ)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } },
    ],
  },
  description:
    '【パートナー黒】【登場時】手札を1枚リムーブしてもよい。そうした場合 AP8000以下を1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const D07004: CardDef = {
  id: 'D07004',
  no: '0389/D07004',
  kind: 'character',
  names: ['ジン'],
  colors: ['黒'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1729865282004728.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
