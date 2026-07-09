// cards/ct-p06/B06043 恋と推理の剣道大会 (case) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   この事件が解決編に移行したとき、自分は手札を1枚リムーブする。\n【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分のデッキのカードを上から3枚見る。その中から〚カード名［服部平次］〛か〚［遠山和葉］〛を1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。この能力は自分の現場に〚カード名［服部平次］〛か〚［遠山和葉］〛がいる場合に宣言できる。

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
  description: 'この事件が解決編に移行したとき、自分は手札を1枚リムーブする。',
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
        kind: 'bond',
        cardName: [
          '服部平次',
          '遠山和葉'
        ]
      }
    ]
  },
  cost: {
    kind: 'flipFaceUpEvidence',
    n: {
      min: 2,
      max: 2
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filter: {
            cardName: [
              '服部平次',
              '遠山和葉'
            ],
            kind: 'character'
          },
          maxN: 3,
          bind: '$revealed',
          bindMatch: '$matched'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'bound',
          key: '$matched',
          presence: 'matched'
        },
        then: {
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: {
            player: 'self',
            cardId: '$matched.cardId'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'deckToBottomBound',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      }
    ]
  },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分のデッキのカードを上から3枚見る。その中から〚カード名［服部平次］〛か〚［遠山和葉］〛を1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。この能力は自分の現場に〚カード名［服部平次］〛か〚［遠山和葉］〛がいる場合に宣言できる。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B06043: CardDef = {
  id: 'B06043',
  no: '0666/B06043',
  kind: 'case',
  names: [
    '恋と推理の剣道大会'
  ],
  colors: [
    '緑'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'C',
  imageUrl: '1754285220443859.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
