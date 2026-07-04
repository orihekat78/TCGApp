// cards/pr-01/PR283 上原由衣 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【FILE7】【自分ターン中】AP＋2000\nこのキャラがアクションしたとき、カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    cs: [
      {
        kind: 'fileAtLeast',
        n: 7
      },
      {
        kind: 'turn',
        player: 'self'
      }
    ],
    kind: 'and'
  },
  continuousModifier: {
    apDelta: 2000
  },
  description: '【FILE7】【自分ターン中】AP＋2000',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    selfOnly: true
  },
  effect: {
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: 'このキャラがアクションしたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md'
  ]
};

export const PR283: CardDef = {
  id: 'PR283',
  no: '0502/PR283',
  kind: 'character',
  names: [
    '上原由衣'
  ],
  colors: [
    '黄'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '警察',
    '長野県警'
  ],
  rarity: 'PR',
  imageUrl: '1779885194368166.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
