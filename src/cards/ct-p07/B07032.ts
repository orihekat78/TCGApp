// cards/ct-p07/B07032 白馬探 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/21-declared-ability-cost.md, rules/17-icons.md, rules/03-field-areas.md
// 公式テキスト:
//   【宣言】【スリープ】〚手札を1枚リムーブする〛：AP8000以下のキャラを1枚まで選び、リムーブする。自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepSelf'
      },
      {
        kind: 'removeFromHand',
        target: {
          kind: 'pick',
          query: {
            area: 'hand',
            side: 'self'
          },
          n: {
            min: 1,
            max: 1
          },
          chooser: 'self'
        },
        n: 1
      }
    ]
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          filter: {
            apMax: 8000
          }
        }
      },
      {
        kind: 'optional',
        effect: {
          kind: 'chain',
          steps: [
            {
              kind: 'atom',
              verb: 'partnerAreaRemove',
              args: {
                player: 'self',
                n: 1,
                filter: {
                  trait: 'ビッグジュエル'
                }
              }
            },
            {
              kind: 'atom',
              verb: 'draw',
              args: {
                player: 'self',
                n: 2
              }
            }
          ]
        }
      }
    ]
  },
  description: '【宣言】【スリープ】〚手札を1枚リムーブする〛：AP8000以下のキャラを1枚まで選び、リムーブする。自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ]
};

export const B07032: CardDef = {
  id: 'B07032',
  no: '0761/B07032',
  kind: 'character',
  names: [
    '白馬探'
  ],
  colors: [
    '白'
  ],
  level: 8,
  ap: 8000,
  lp: 2,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'SR',
  imageUrl: '1759154512406883.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ],
};
