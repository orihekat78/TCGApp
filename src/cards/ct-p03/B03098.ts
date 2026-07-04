// cards/ct-p03/B03098 諸伏高明 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/17-icons.md, rules/15-abilities-effects.md
// 公式テキスト:
//   このキャラがスリープ状態で登場したとき、このキャラをアクティブにする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、アクティブにする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  condition: {
    kind: 'charStateIs',
    ref: {
      kind: 'self'
    },
    state: 'sleep'
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      state: 'active',
      uid: '$self'
    }
  },
  description: 'このキャラがスリープ状態で登場したとき、このキャラをアクティブにする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/17-icons.md'
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
      max: 1,
      player: 'self',
      side: 'either',
      state: 'active'
    },
    kind: 'atom',
    verb: 'sceneSetState'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、アクティブにする。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md'
  ]
};

export const B03098: CardDef = {
  id: 'B03098',
  no: '0351/B03098',
  kind: 'character',
  names: [
    '諸伏高明'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '長野県警'
  ],
  rarity: 'C',
  imageUrl: '1729133463288363.jpg',
  keywords: [
    'ヒラメキ'
  ],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md'
  ],
};
