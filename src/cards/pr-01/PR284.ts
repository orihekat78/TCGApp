// cards/pr-01/PR284 諸伏高明 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【絆大和敢助】【自分ターン中】AP＋2000\n自分のリムーブエリアに〚特徴［長野県警］〛のキャラが2枚以上ある場合、このキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    cs: [
      {
        cardName: '大和敢助',
        kind: 'bond'
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
  description: '【絆大和敢助】【自分ターン中】AP＋2000',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'removeTraitAtLeast',
    player: 'self',
    trait: '長野県警',
    n: 2
  },
  continuousModifier: {
    grantKeywords: () => ['突撃']
  },
  description: '自分のリムーブエリアに〚特徴［長野県警］〛のキャラが2枚以上ある場合、このキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md'
  ]
};

export const PR284: CardDef = {
  id: 'PR284',
  no: '0501/PR284',
  kind: 'character',
  names: [
    '諸伏高明'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  ap: 5000,
  lp: 2,
  traits: [
    '警察',
    '長野県警'
  ],
  rarity: 'PR',
  imageUrl: '1779885194375923.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
