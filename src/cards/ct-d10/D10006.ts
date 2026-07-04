// cards/ct-d10/D10006 ハート姫（毛利蘭） (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【事件シャッフルロマンス】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル8以下の〚カード名［黒衣の騎士・スペイド］〛を1枚まで選び、登場させる。\n【絆工藤新一】【宣言】【ターン1】手札から〚カード名［シャッフルロマンス］〛のイベントを1枚まで使用する。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  condition: {
    cs: [
      {
        kind: 'caseTrait',
        trait: 'シャッフルロマンス'
      },
      {
        c: {
          kind: 'charStateIs',
          ref: {
            kind: 'self'
          },
          state: 'sleep'
        },
        kind: 'not'
      }
    ],
    kind: 'and'
  },
  effect: {
    effect: {
      kind: 'chain',
      steps: [
        {
          args: {
            state: 'sleep',
            uid: '$self'
          },
          kind: 'atom',
          verb: 'sceneSetState'
        },
        {
          args: {
            n: 1,
            player: 'self'
          },
          kind: 'atom',
          verb: 'discard'
        },
        {
          args: {
            filter: {
              cardName: '黒衣の騎士・スペイド',
              kind: 'character',
              levelMax: 8
            },
            from: 'remove',
            max: 1,
            player: 'self',
            viaEffect: true
          },
          kind: 'atom',
          verb: 'sceneEnter'
        }
      ]
    },
    kind: 'optional'
  },
  description: '【事件シャッフルロマンス】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル8以下の〚カード名［黒衣の騎士・スペイド］〛を1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    cardName: '工藤新一',
    kind: 'bond'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    args: {
      filter: {
        cardName: 'シャッフルロマンス',
        kind: 'event'
      },
      max: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'useEventFromHand'
  },
  description: '【絆工藤新一】【宣言】【ターン1】手札から〚カード名［シャッフルロマンス］〛のイベントを1枚まで使用する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const D10006: CardDef = {
  id: 'D10006',
  no: '0839/D10006',
  kind: 'character',
  names: [
    'ハート姫（毛利蘭）'
  ],
  colors: [
    '青'
  ],
  level: 8,
  ap: 6000,
  lp: 1,
  traits: [
    '高校生',
    '毛利探偵事務所',
    '空手家'
  ],
  rarity: 'D',
  imageUrl: '1761913165213359.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
