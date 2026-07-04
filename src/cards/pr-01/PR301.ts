// cards/pr-01/PR301 ジン (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【カットイン】【自分ターン中】AP＋3000（自分のターンのコンタクト中に手札からリムーブして使う）

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
  condition: {
    kind: 'turn',
    player: 'self'
  },
  effect: {
    args: {
      delta: 3000,
      scope: 'contact',
      uid: '$contact.byUid'
    },
    kind: 'atom',
    verb: 'charModifyAP'
  },
  description: '【カットイン】【自分ターン中】AP＋3000（自分のターンのコンタクト中に手札からリムーブして使う）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const PR301: CardDef = {
  id: 'PR301',
  no: '1037/PR301',
  kind: 'character',
  names: [
    'ジン'
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
  imageUrl: '1779885194487245.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
