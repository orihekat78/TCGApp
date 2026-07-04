// cards/pr-01/PR286 ハイウェイの堕天使 (case) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。\n【解決編】【宣言】【ターン1】〚手札から、〚特徴［神奈川県警］〛のキャラか【疾風】を持つキャラを1枚リムーブする〛：このターン中、次に自分の現場に登場したキャラは【疾風】の条件を無視できる。（2番目以降に登場しても発動する）

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
  cost: {
    kind: 'removeFromHand',
    n: 1,
    target: {
      chooser: 'self',
      kind: 'pick',
      n: {
        max: 1,
        min: 1
      },
      query: {
        area: 'hand',
        filterAny: [
          {
            kind: 'character',
            trait: '神奈川県警'
          },
          {
            keyword: '疾風',
            kind: 'character'
          }
        ],
        side: 'self'
      }
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    args: {
      player: 'self'
    },
    kind: 'atom',
    verb: 'setShippuWaive'
  },
  description: '【解決編】【宣言】【ターン1】〚手札から、〚特徴［神奈川県警］〛のキャラか【疾風】を持つキャラを1枚リムーブする〛：このターン中、次に自分の現場に登場したキャラは【疾風】の条件を無視できる。（2番目以降に登場しても発動する）',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const PR286: CardDef = {
  id: 'PR286',
  no: '1059/PR286',
  kind: 'case',
  names: [
    'ハイウェイの堕天使'
  ],
  colors: [
    '黄'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'PR',
  imageUrl: '1779885194389343.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
