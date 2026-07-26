// cards/ct-p07/B07005 毛利小五郎 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/09-cutin-disguise.md, rules/13-keywords.md, rules/17-icons.md
// 公式テキスト:
//   【絆妃英理】〚突撃〛（登場したターンからすぐにアクションできる）\n自分の現場に〚カード名［妃英理］〛がいない場合、このキャラはアクションできない。\nこのキャラのコンタクト中、自分は【カットイン】を使用できない。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'bond',
    cardName: '妃英理'
  },
  continuousModifier: {
    grantKeywords: () => ['突撃'], printedKeywordWhenIconValid: true,
  },
  description: '【絆妃英理】〚突撃〛（登場したターンからすぐにアクションできる）',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'not',
    c: {
      kind: 'bond',
      cardName: '妃英理'
    }
  },
  continuousModifier: {
    selfActionBan: true
  },
  description: '自分の現場に〚カード名［妃英理］〛がいない場合、このキャラはアクションできない。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/17-icons.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: {
    selfCutinBanInContact: true
  },
  description: 'このキャラのコンタクト中、自分は【カットイン】を使用できない。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md'
  ]
};

export const B07005: CardDef = {
  id: 'B07005',
  no: '0737/B07005',
  kind: 'character',
  names: [
    '毛利小五郎'
  ],
  colors: [
    '青'
  ],
  level: 6,
  ap: 8000,
  lp: 0,
  traits: [
    '探偵',
    '毛利探偵事務所'
  ],
  rarity: 'R',
  imageUrl: '1762413976065720.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/17-icons.md'
  ],
};
