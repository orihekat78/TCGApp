// cards/ct-d06/D06009 大滝悟郎 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/08-contact.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【現場リムーブ時】コンタクトによってリムーブされた場合、キャラを1枚まで選び、スリープさせる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true,
    matcherCondition: {
      kind: 'removedCharMatches',
      cause: 'contact-ap'
    }
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      state: 'sleep',
      player: 'self',
      max: 1,
      side: 'either'
    }
  },
  description: '【現場リムーブ時】コンタクトによってリムーブされた場合、キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
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

export const D06009: CardDef = {
  id: 'D06009',
  no: '0029/D06009',
  kind: 'character',
  names: [
    '大滝悟郎'
  ],
  colors: [
    '緑'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '警察',
    '大阪府警'
  ],
  rarity: 'D',
  imageUrl: '1718844176817683.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ],
};
