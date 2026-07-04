// cards/pr-01/PR293 キャンティ (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【カットイン】AP＋2000（コンタクト中に手札からリムーブして使う）

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  effect: {
    args: {
      delta: 2000,
      scope: 'contact',
      uid: '$contact.byUid'
    },
    kind: 'atom',
    verb: 'charModifyAP'
  },
  description: '【カットイン】AP＋2000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const PR293: CardDef = {
  id: 'PR293',
  no: '0368/PR293',
  kind: 'character',
  names: [
    'キャンティ'
  ],
  colors: [
    '黒'
  ],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'PR',
  imageUrl: '1779885194430284.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
