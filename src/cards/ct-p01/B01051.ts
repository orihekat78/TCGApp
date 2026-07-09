// cards/ct-p01/B01051 京極真 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/24-qa-naming-stun.md, rules/17-icons.md
// 公式テキスト:
//   〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）\nこのキャラは事件を指定してアクションできない。\n【自分ターン中】AP＋1000

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: {
    caseActionBan: true
  },
  description: 'このキャラは事件を指定してアクションできない。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/24-qa-naming-stun.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'self'
  },
  continuousModifier: {
    apDelta: 1000
  },
  description: '【自分ターン中】AP＋1000',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B01051: CardDef = {
  id: 'B01051',
  no: '0043/B01051',
  kind: 'character',
  names: [
    '京極真'
  ],
  colors: [
    '白'
  ],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: [
    '高校生',
    '空手家'
  ],
  rarity: 'C',
  imageUrl: '1714013041150344.jpg',
  keywords: [
    '突撃[キャラ]'
  ],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/24-qa-naming-stun.md',
    'rules/17-icons.md'
  ],
};
