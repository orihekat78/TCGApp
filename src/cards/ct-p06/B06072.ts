// cards/ct-p06/B06072 かぐや (character) — Task A green候補 (engine変更0)
// rules: rules/12-next-hint.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/25-qa-effects-resolution.md
// 公式テキスト:
//   【事件YAIBA】手札から使用する場合、このキャラは事件カードの色を無視できる。（ネクストヒントでの使用も「手札から使用」に含まれる）\n【登場時】自分のリムーブエリアにある〚特徴［YAIBA］〛のカードが14枚以下の場合、レベル7以下のキャラを1枚まで選び、デッキの下に移す。自分のリムーブエリアに〚特徴［YAIBA］〛のカードが15枚以上ある場合、以下を順に行う。「自分のリムーブエリアにあるすべてのカードをデッキの下に移し、デッキをシャッフルする。」「キャラを1枚まで選び、デッキの下に移す。」「カードを1枚引く。」「相手は手札を1枚リムーブする。」「相手は証拠を1つ得る。」

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-hand',
  condition: {
    kind: 'caseTrait',
    trait: 'YAIBA'
  },
  continuousModifier: {
    colorIgnoreOnHandUse: true
  },
  description: '【事件YAIBA】手札から使用する場合、このキャラは事件カードの色を無視できる。（ネクストヒントでの使用も「手札から使用」に含まれる）',
  ruleRefs: [
    'rules/20-color-and-switch.md',
    'rules/17-icons.md',
    'rules/12-next-hint.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'conditional',
        if: {
          kind: 'not',
          c: {
            kind: 'removeTraitAtLeast',
            player: 'self',
            trait: 'YAIBA',
            n: 15
          }
        },
        then: {
          kind: 'atom',
          verb: 'sceneToDeck',
          args: {
            player: 'self',
            side: 'either',
            max: 1,
            filter: {
              levelMax: 7
            },
            pos: 'bottom'
          }
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'removeTraitAtLeast',
          player: 'self',
          trait: 'YAIBA',
          n: 15
        },
        then: {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'removeAreaAllToDeckBottom',
              args: {
                player: 'self'
              }
            },
            {
              kind: 'atom',
              verb: 'sceneToDeck',
              args: {
                player: 'self',
                side: 'either',
                max: 1,
                pos: 'bottom'
              }
            },
            {
              kind: 'atom',
              verb: 'draw',
              args: {
                player: 'self',
                n: 1
              }
            },
            {
              kind: 'atom',
              verb: 'discard',
              args: {
                player: 'opp',
                n: 1
              }
            },
            {
              kind: 'atom',
              verb: 'evidenceGain',
              args: {
                player: 'opp',
                n: 1
              }
            }
          ]
        }
      }
    ]
  },
  description: '【登場時】自分のリムーブエリアにある〚特徴［YAIBA］〛のカードが14枚以下の場合、レベル7以下のキャラを1枚まで選び、デッキの下に移す。自分のリムーブエリアに〚特徴［YAIBA］〛のカードが15枚以上ある場合、以下を順に行う。「自分のリムーブエリアにあるすべてのカードをデッキの下に移し、デッキをシャッフルする。」「キャラを1枚まで選び、デッキの下に移す。」「カードを1枚引く。」「相手は手札を1枚リムーブする。」「相手は証拠を1つ得る。」',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/25-qa-effects-resolution.md'
  ]
};

export const B06072: CardDef = {
  id: 'B06072',
  no: '0693/B06072',
  kind: 'character',
  names: [
    'かぐや'
  ],
  colors: [
    '赤'
  ],
  level: 8,
  ap: 8000,
  lp: 2,
  traits: [
    'YAIBA'
  ],
  rarity: 'R',
  imageUrl: '1754285244529147.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/25-qa-effects-resolution.md'
  ],
};
