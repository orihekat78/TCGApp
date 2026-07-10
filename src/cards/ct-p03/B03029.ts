// cards/ct-p03/B03029 遠山和葉 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【宣言】【ターン1】【スリープ】〚リムーブエリアにある【緑】のイベントを2枚好きな順番でデッキの下に移す〛：手札からレベル5か6の【緑】のイベントを1枚まで使用する。

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
        kind: 'removeAreaToDeckBottom',
        target: {
          kind: 'pick',
          query: {
            area: 'remove',
            side: 'self',
            filter: {
              color: '緑',
              kind: 'event'
            }
          },
          n: {
            min: 2,
            max: 2
          },
          chooser: 'owner'
        },
        n: 2
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'useEventFromHand',
    args: {
      player: 'self',
      max: 1,
      filter: {
        color: '緑',
        levelIn: [
          5,
          6
        ],
        kind: 'event'
      }
    }
  },
  description: '【宣言】【ターン1】【スリープ】〚リムーブエリアにある【緑】のイベントを2枚好きな順番でデッキの下に移す〛：手札からレベル5か6の【緑】のイベントを1枚まで使用する。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B03029: CardDef = {
  id: 'B03029',
  no: '0286/B03029',
  kind: 'character',
  names: [
    '遠山和葉'
  ],
  colors: [
    '緑'
  ],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: [
    '高校生'
  ],
  rarity: 'SR',
  imageUrl: '1729133249256452.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
