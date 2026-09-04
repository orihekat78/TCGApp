// cards/ct-p08/B08022 綾小路文麿 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【登場時】手札を1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、
//     リムーブし、自分のリムーブエリアにある〚カード名［マロちゃん］〛を1枚まで選び、手札に加える。
//
// a1: enter trigger → chain[ 手札1枚までリム(任意) → そうした場合 [AP8000以下を1枚までリム + リムーブの[マロちゃん]を1枚まで手札へ] ]
//     chain step1=discard(max:1) が適用された場合のみ step2 を実行 (D08003 / D03002 chain 同型)。
//     step2 は sequence — sceneRemove(pick) → handAddFromRemove(pick) の順 (公式テキスト順、$pick 明示 target は D03002 a1 / D08019 a2 同型)。

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
      // 手札を1枚リムーブしてもよい (max:1 で skip 可能、skip 時は chain break)
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      // そうした場合、AP8000以下のキャラを1枚までリムーブし、リムーブの[マロちゃん]を1枚まで手札へ (step1 実効果あり時のみ)
      {
        kind: 'sequence',
        steps: [
          // AP8000以下のキャラを1枚まで選び、リムーブする
          { kind: 'atom', verb: 'sceneRemove', args: { uid: '$pick', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { apMax: 8000 } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
          // 自分のリムーブエリアにある[マロちゃん]を1枚まで選び、手札に加える
          { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { cardName: 'マロちゃん' } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
        ],
      },
    ],
  },
  description:
    '【登場時】手札を1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚までリムーブし、リムーブの[マロちゃん]を1枚まで手札に加える。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B08022: CardDef = {
  id: 'B08022',
  no: '0862/B08022',
  kind: 'character',
  names: ['綾小路文麿'],
  colors: ['緑'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['警察', '京都府警'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731204442969.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
