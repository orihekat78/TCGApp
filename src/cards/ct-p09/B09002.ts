// cards/ct-p09/B09002 工藤新一&毛利蘭 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md, rules/19-special-rules.md, rules/22-qa-action-contact.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚カード名［工藤新一］〛か〚［毛利蘭］〛が登場したとき、相手の現場にいるレベル9以下のキャラを1枚まで選び、リムーブするかデッキの下に移す。（自分がどちらかを選ぶ）\n自分のターン終了時、手札から〚カード名［工藤新一］〛か〚［毛利蘭］〛を1枚公開してもよい。そうした場合、自分の現場にいるレベル8以上の〚カード名［工藤新一］〛か〚［毛利蘭］〛を1枚まで選び、アクティブにする。この能力はパートナーエリアでも発動する。
//   【カットイン】AP＋2000

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      payloadKey: 'uid', // enter emit payload に player 無し — uid 経由で side 解決 (B08062 a1 同型、probe 実測)
      excludeSource: true,
      filter: {
        cardName: [
          '工藤新一',
          '毛利蘭'
        ],
        kind: 'character'
      }
    }
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'opp',
          cause: 'effect',
          filter: {
            levelMax: 9
          }
        }
      },
      {
        kind: 'atom',
        verb: 'sceneToDeck',
        args: {
          player: 'self',
          max: 1,
          side: 'opp',
          pos: 'bottom',
          filter: {
            levelMax: 9
          }
        }
      }
    ]
  },
  description: '【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚カード名［工藤新一］〛か〚［毛利蘭］〛が登場したとき、相手の現場にいるレベル9以下のキャラを1枚まで選び、リムーブするかデッキの下に移す。（自分がどちらかを選ぶ）',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/24-qa-naming-stun.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-partner-area',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'handReveal',
        args: {
          player: 'self',
          max: 1,
          filter: {
            cardName: [
              '工藤新一',
              '毛利蘭'
            ]
          }
        }
      },
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          player: 'self',
          max: 1,
          side: 'self',
          state: 'active',
          filter: {
            cardName: [
              '工藤新一',
              '毛利蘭'
            ],
            levelMin: 8
          }
        }
      }
    ]
  },
  description: '自分のターン終了時、手札から〚カード名［工藤新一］〛か〚［毛利蘭］〛を1枚公開してもよい。そうした場合、自分の現場にいるレベル8以上の〚カード名［工藤新一］〛か〚［毛利蘭］〛を1枚まで選び、アクティブにする。この能力はパートナーエリアでも発動する。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  effect: {
    args: {
      delta: 2000,
      scope: 'contact',
      uid: '$contact.byUid'
    },
    kind: 'atom',
    verb: 'charModifyAP'
  },
  description: '【カットイン】AP＋2000',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B09002: CardDef = {
  id: 'B09002',
  no: '0947/B09002',
  kind: 'character',
  names: ['工藤新一&毛利蘭', '工藤新一', '毛利蘭'], // rules/19 複数名カード (BUG-185 一括分割 2026-07-10)
  colors: [
    '青'
  ],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: [
    '探偵',
    '毛利探偵事務所',
    '高校生',
    '空手家'
  ],
  rarity: 'MR',
  imageUrl: '1775608802546440.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md'
  ],
};
