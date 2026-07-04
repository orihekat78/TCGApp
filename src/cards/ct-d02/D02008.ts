// cards/ct-d02/D02008 服部平蔵 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/09-cutin-disguise.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   このキャラがアクションしたとき、アクション終了時まで相手は【カットイン】を使用できない。\n相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'charSetTurnEffect',
    args: {
      uid: '$self',
      key: 'cutinBanOpp_action',
      val: true
    }
  },
  description: 'このキャラがアクションしたとき、アクション終了時まで相手は【カットイン】を使用できない。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove'
  },
  condition: {
    by: 'self',
    cause: 'contact-ap',
    kind: 'removedCharMatches',
    side: 'opp'
  },
  effect: {
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const D02008: CardDef = {
  id: 'D02008',
  no: '0111/D02008',
  kind: 'character',
  names: [
    '服部平蔵'
  ],
  colors: [
    '緑'
  ],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: [
    '警察',
    '大阪府警'
  ],
  rarity: 'D',
  imageUrl: '1714013117371611.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md'
  ],
};
