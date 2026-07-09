// cards/ct-p08/B08076 揺れる警視庁 1200万人の人質 (case) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/03-field-areas.md, rules/11-reasoning.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。\n【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにし、現場にいるキャラを1枚デッキの下に移す〛：自分の現場にいるすべてのキャラが〚カード名［佐藤美和子］〛か〚［高木渉］〛の場合、自分のリムーブエリアにあるレベル4以下の〚カード名［佐藤美和子］〛か〚［高木渉］〛を1枚まで選び、スリープ状態で登場させる。この能力は自分の現場にキャラが2枚以上いる場合に宣言できる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always',
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true
  },
  effect: {
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'discard'
  },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseStatus',
        status: '解決編'
      },
      {
        kind: 'sceneHas',
        query: {
          area: 'scene',
          side: 'self',
          filter: {
            kind: 'character'
          }
        },
        nMin: 2
      }
    ]
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'flipFaceUpEvidence',
        n: {
          min: 2,
          max: 2
        }
      },
      {
        kind: 'sceneToDeckBottom',
        target: {
          kind: 'pick',
          query: {
            area: 'scene',
            side: 'self',
            filter: {
              kind: 'character'
            }
          },
          n: {
            min: 1,
            max: 1
          },
          chooser: 'owner'
        },
        n: 1
      }
    ]
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'not',
      c: {
        kind: 'sceneHas',
        query: {
          area: 'scene',
          side: 'self',
          filter: {
            kind: 'character',
            cardNameNot: [
              '佐藤美和子',
              '高木渉'
            ]
          }
        },
        nMin: 1
      }
    },
    then: {
      kind: 'atom',
      verb: 'sceneEnter',
      args: {
        player: 'self',
        from: 'remove',
        max: 1,
        viaEffect: true,
        enterSleep: true,
        filterAny: [
          {
            kind: 'character',
            cardName: '佐藤美和子',
            levelMax: 4
          },
          {
            kind: 'character',
            cardName: '高木渉',
            levelMax: 4
          }
        ]
      }
    }
  },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにし、現場にいるキャラを1枚デッキの下に移す〛：自分の現場にいるすべてのキャラが〚カード名［佐藤美和子］〛か〚［高木渉］〛の場合、自分のリムーブエリアにあるレベル4以下の〚カード名［佐藤美和子］〛か〚［高木渉］〛を1枚まで選び、スリープ状態で登場させる。この能力は自分の現場にキャラが2枚以上いる場合に宣言できる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B08076: CardDef = {
  id: 'B08076',
  no: '0913/B08076',
  kind: 'case',
  names: [
    '揺れる警視庁 1200万人の人質'
  ],
  colors: [
    '黄'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'C',
  imageUrl: '1770731255789606.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/03-field-areas.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ],
};
