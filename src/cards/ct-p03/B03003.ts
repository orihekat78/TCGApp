// cards/ct-p03/B03003 灰原哀 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【宣言】【ターン1】【スリープ】〚デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによって〚カード名［阿笠博士］〛か〚特徴［少年探偵団］〛のキャラがリムーブされた場合、レベル8以下のキャラを1枚まで選び、デッキの下に移す。

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
        kind: 'sleepSelf'
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
      kind: 'or',
      cs: [
        {
          kind: 'costRemovedMatches',
          filter: {
            cardName: '阿笠博士'
          }
        },
        {
          kind: 'costRemovedMatches',
          filter: {
            trait: '少年探偵団'
          }
        }
      ]
    },
    then: {
      kind: 'atom',
      verb: 'sceneToDeck',
      args: {
        player: 'self',
        side: 'either',
        max: 1,
        pos: 'bottom',
        filter: {
          levelMax: 8
        }
      }
    }
  },
  description: '【宣言】【ターン1】【スリープ】〚デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによって〚カード名［阿笠博士］〛か〚特徴［少年探偵団］〛のキャラがリムーブされた場合、レベル8以下のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B03003: CardDef = {
  id: 'B03003',
  no: '0261/B03003',
  kind: 'character',
  names: [
    '灰原哀'
  ],
  colors: [
    '青'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '少年探偵団',
    '科学者'
  ],
  rarity: 'SR',
  imageUrl: '1729133048239125.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
