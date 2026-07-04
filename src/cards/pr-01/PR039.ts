// cards/pr-01/PR039 中森青子 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/22-qa-action-contact.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md
// 公式テキスト:
//   【ターン1】自分の現場にいる〚特徴［怪盗］〛のキャラがアクションしたとき、ターン終了時までそのキャラをAP＋1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare'
  },
  condition: {
    kind: 'triggerCharMatches',
    side: 'self',
    filter: {
      trait: '怪盗'
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$trigger.byUid',
      delta: 1000,
      scope: 'turn'
    }
  },
  description: '【ターン1】自分の現場にいる〚特徴［怪盗］〛のキャラがアクションしたとき、ターン終了時までそのキャラをAP＋1000する。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/22-qa-action-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
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

export const PR039: CardDef = {
  id: 'PR039',
  no: '0215/PR039',
  kind: 'character',
  names: [
    '中森青子'
  ],
  colors: [
    '白'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'PR',
  imageUrl: '1922d21c53428b.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/22-qa-action-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ],
};
