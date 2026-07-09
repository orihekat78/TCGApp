// cards/pr-01/PR067 探偵の目 (case) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/27-card-restrictions.md
// 公式テキスト:
//   この事件は指定されたイベントでのみ使用できる。<br>自分のパートナーの色は【青】【緑】【白】【赤】【黄】【黒】になる。<br>自分の現場に置けるキャラの枚数は〚最大4枚まで〛になる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'always',
  continuousModifier: {
    partnerColorsOverride: [
      '青',
      '緑',
      '白',
      '赤',
      '黄',
      '黒'
    ]
  },
  description: '自分のパートナーの色は【青】【緑】【白】【赤】【黄】【黒】になる。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'always',
  continuousModifier: {
    sceneCapOverride: 4
  },
  description: '自分の現場に置けるキャラの枚数は〚最大4枚まで〛になる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/20-color-and-switch.md'
  ]
};

export const PR067: CardDef = {
  id: 'PR067',
  no: '0407/PR067',
  kind: 'case',
  names: [
    '探偵の目'
  ],
  colors: [
    '青',
    '緑',
    '白',
    '赤',
    '黄',
    '黒'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'PR',
  imageUrl: '1732542002124471.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/27-card-restrictions.md'
  ],
};
