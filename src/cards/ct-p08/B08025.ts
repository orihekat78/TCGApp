// cards/ct-p08/B08025 伊織無我 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【パートナー緑】【宣言】【ターン1】〚デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによって〚カード名［大岡紅葉］〛か〚［伊織無我］〛がリムーブされた場合、AP8000以下のキャラを1枚まで選び、リムーブし、自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '緑'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'removeDeckTop',
    player: 'self',
    n: 3
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'or',
      cs: [
        {
          kind: 'costRemovedMatches',
          filter: {
            cardName: '大岡紅葉'
          }
        },
        {
          kind: 'costRemovedMatches',
          filter: {
            cardName: '伊織無我'
          }
        }
      ]
    },
    then: {
      kind: 'sequence',
      steps: [
        {
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
        },
        {
          kind: 'atom',
          verb: 'charSetCard',
          args: {
            uid: '$self',
            fromDeckTop: true,
            faceUp: false,
            player: 'self'
          }
        }
      ]
    }
  },
  description: '【パートナー緑】【宣言】【ターン1】〚デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによって〚カード名［大岡紅葉］〛か〚［伊織無我］〛がリムーブされた場合、AP8000以下のキャラを1枚まで選び、リムーブし、自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B08025: CardDef = {
  id: 'B08025',
  no: '0865/B08025',
  kind: 'character',
  names: [
    '伊織無我'
  ],
  colors: [
    '緑'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '執事'
  ],
  rarity: 'C',
  imageUrl: '1770731204462368.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
