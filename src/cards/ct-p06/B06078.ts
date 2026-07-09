// cards/ct-p06/B06078 羽田秀𠮷 (character) — Task A green候補 (engine変更0)
// rules: rules/21-declared-ability-cost.md, rules/15-abilities-effects.md, rules/19-special-rules.md, rules/17-icons.md, rules/10-action-event.md, rules/03-field-areas.md
// 公式テキスト:
//   【宣言】【ターン1】〚レベル6以上の特徴［赤井家］のキャラを1枚スリープさせ、デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによって〚特徴［赤井家］〛のキャラがリムーブされた場合、AP8000以下のキャラを1枚まで選び、リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepChar',
        target: {
          kind: 'pick',
          query: {
            area: 'scene',
            side: 'self',
            filter: {
              trait: '赤井家',
              levelMin: 6
            }
          },
          n: {
            min: 1,
            max: 1
          },
          chooser: 'self'
        }
      },
      {
        kind: 'removeDeckTop',
        player: 'self',
        n: 3
      }
    ]
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'costRemovedMatches',
      filter: {
        trait: '赤井家'
      },
      n: 1
    },
    then: {
      kind: 'atom',
      verb: 'sceneRemove',
      args: {
        player: 'self',
        max: 1,
        side: 'either',
        cause: 'effect',
        filter: {
          apMax: 8000
        }
      }
    }
  },
  description: '【宣言】【ターン1】〚レベル6以上の特徴［赤井家］のキャラを1枚スリープさせ、デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによって〚特徴［赤井家］〛のキャラがリムーブされた場合、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
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
      state: 'sleep',
      target: {
        chooser: 'self',
        kind: 'pick',
        n: {
          max: 1,
          min: 0
        },
        query: {
          area: 'scene',
          side: 'either'
        }
      },
      uid: '$pick'
    },
    kind: 'atom',
    verb: 'sceneSetState'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md'
  ]
};

export const B06078: CardDef = {
  id: 'B06078',
  no: '0698/B06078',
  kind: 'character',
  names: [
    '羽田秀𠮷'
  ],
  colors: [
    '赤'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '棋士',
    '赤井家'
  ],
  rarity: 'R',
  imageUrl: '1754285244557673.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/17-icons.md',
    'rules/10-action-event.md',
    'rules/03-field-areas.md'
  ],
};
