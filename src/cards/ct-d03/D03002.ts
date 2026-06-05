// cards/ct-d03/D03002 怪盗キッド (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【パートナー白】【登場時】手札を1枚リムーブしてもよい。そうした場合、キャラを1枚まで選び、スタンさせ、自分は証拠を1つ得る。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//
// a1: enter trigger (partnerColor 白) → chain[ 手札1枚までリム(任意) → そうした場合 [キャラ1枚までスタン + 証拠1つ得る] ]
//     chain step1=discard(max:1) が適用された場合のみ step2 を実行 (D08003 chain 同型)。
//     step2 は sequence — スタン(pick) → 証拠+1 の順 (公式テキスト順、sceneSetState は D08019 a2 同型 $pick + target)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー白】
  condition: { kind: 'partnerColor', color: '白' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札を1枚リムーブしてもよい
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      // そうした場合、キャラを1枚まで選びスタンさせ、自分は証拠を1つ得る
      {
        kind: 'sequence',
        steps: [
          // キャラを1枚まで選び、スタンさせる
          { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'stun', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } } },
          // 自分は証拠を1つ得る
          { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } },
        ],
      },
    ],
  },
  description:
    '【パートナー白】【登場時】手札を1枚リムーブしてもよい。そうした場合、キャラを1枚までスタンさせ、証拠を1つ得る。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const D03002: CardDef = {
  id: 'D03002',
  no: '0119/D03002',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['怪盗'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013117398403.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
