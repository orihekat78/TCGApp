// cards/ct-p09/B09111 外交官殺人事件 (case) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。\n【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：カード名を1つ指定し、相手のFILEエリアにあるカードを上から1枚リムーブし、相手はデッキのカードを上から1枚裏向きのままFILEエリアの上に置く。この効果によって指定したカード名のカードがリムーブされた場合、レベル6のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。

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
    kind: 'caseStatus',
    status: '解決編'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'flipFaceUpEvidence',
    n: {
      min: 2,
      max: 2
    }
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'declareName',
        args: {
          bind: 'named',
          domain: 'registered-card-name'
        }
      },
      {
        kind: 'atom',
        verb: 'fileRemoveTop',
        args: {
          player: 'opp',
          n: 1,
          bind: 'removed'
        }
      },
      {
        kind: 'atom',
        verb: 'fileAdd',
        args: {
          player: 'opp',
          n: 1
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'boundNameMatchesDeclared',
          bindKey: 'removed',
          declareKey: 'named'
        },
        then: {
          kind: 'atom',
          verb: 'charGrantKeyword',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            filter: {
              levelMin: 6,
              levelMax: 6,
              kind: 'character'
            },
            kw: '突撃[キャラ]',
            scope: 'turn'
          }
        }
      }
    ]
  },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：カード名を1つ指定し、相手のFILEエリアにあるカードを上から1枚リムーブし、相手はデッキのカードを上から1枚裏向きのままFILEエリアの上に置く。この効果によって指定したカード名のカードがリムーブされた場合、レベル6のキャラを1枚まで選び、ターン終了時まで突撃［キャラ］を与える。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/12-next-hint.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B09111: CardDef = {
  id: 'B09111',
  no: '1050/B09111',
  kind: 'case',
  names: [
    '外交官殺人事件'
  ],
  colors: [
    '青',
    '緑'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'C',
  imageUrl: '1775608962359001.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
