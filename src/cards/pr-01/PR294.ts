// cards/pr-01/PR294 怪盗キッド (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【カットイン】AP＋2000

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
  description: '【カットイン】AP＋2000',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const PR294: CardDef = {
  id: 'PR294',
  no: '0431/PR294',
  kind: 'character',
  names: [
    '怪盗キッド'
  ],
  colors: [
    '白'
  ],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: [
    '怪盗'
  ],
  rarity: 'PR',
  imageUrl: '1779885194437594.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
