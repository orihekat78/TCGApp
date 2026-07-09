// cards/ct-p05/B05012 恩田遼平 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/19-special-rules.md, rules/23-qa-disguise-cutin.md
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）\n現場にいるこのキャラは〚カード名［毛利小五郎］〛としても扱い、〚特徴［探偵］〛を持つ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'icon-misread',
  scope: 'on-scene',
  effect: {
    args: {
      kind: 'misread-marker',
      x: 1
    },
    kind: 'atom',
    verb: 'noop'
  },
  description: '〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）',
  ruleRefs: [
    'rules/13-keywords.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: {
    grantNames: [
      '毛利小五郎'
    ],
    grantTraits: [
      '探偵'
    ]
  },
  description: '現場にいるこのキャラは〚カード名［毛利小五郎］〛としても扱い、〚特徴［探偵］〛を持つ。',
  ruleRefs: [
    'rules/19-special-rules.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B05012: CardDef = {
  id: 'B05012',
  no: '0518/B05012',
  kind: 'character',
  names: [
    '恩田遼平'
  ],
  colors: [
    '青'
  ],
  level: 3,
  ap: 3000,
  lp: 0,
  traits: [
    '大学生'
  ],
  rarity: 'C',
  imageUrl: '1746628061716056.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/19-special-rules.md',
    'rules/23-qa-disguise-cutin.md'
  ],
};
