// cards/ct-p05/B05031 伊織無我 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【登場時】相手の現場にいるキャラを1枚まで選び、相手のデッキのカードを上から1枚裏向きでセットする。\n【宣言】【スリープ】〚リムーブエリアに移す〛：手札からレベル6以下の〚カード名［大岡紅葉］〛のキャラを1枚まで登場させるか、自分のリムーブエリアにあるレベル6以下の〚カード名［大岡紅葉］〛を1枚まで選び、登場させる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    args: {
      faceUp: false,
      fromDeckTop: true,
      max: 1,
      player: 'opp',
      side: 'opp'
    },
    kind: 'atom',
    verb: 'charSetCard'
  },
  description: '【登場時】相手の現場にいるキャラを1枚まで選び、相手のデッキのカードを上から1枚裏向きでセットする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepSelf'
      },
      {
        kind: 'removeFromScene',
        target: {
          kind: 'self'
        },
        n: 1
      }
    ]
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          cardId: '$pick.cardId',
          from: 'hand',
          viaEffect: true,
          target: {
            kind: 'pick',
            query: {
              area: 'hand',
              side: 'self',
              filter: {
                cardName: '大岡紅葉',
                levelMax: 6,
                kind: 'character'
              }
            },
            n: {
              min: 0,
              max: 1
            },
            chooser: 'self'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          cardId: '$pick.cardId',
          from: 'remove',
          viaEffect: true,
          target: {
            kind: 'pick',
            query: {
              area: 'remove',
              side: 'self',
              filter: {
                cardName: '大岡紅葉',
                levelMax: 6,
                kind: 'character'
              }
            },
            n: {
              min: 0,
              max: 1
            },
            chooser: 'self'
          }
        }
      }
    ]
  },
  description: '【宣言】【スリープ】〚リムーブエリアに移す〛：手札からレベル6以下の〚カード名［大岡紅葉］〛のキャラを1枚まで登場させるか、自分のリムーブエリアにあるレベル6以下の〚カード名［大岡紅葉］〛を1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B05031: CardDef = {
  id: 'B05031',
  no: '0535/B05031',
  kind: 'character',
  names: [
    '伊織無我'
  ],
  colors: [
    '緑'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '執事'
  ],
  rarity: 'C',
  imageUrl: '1745322178444096.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md'
  ],
};
