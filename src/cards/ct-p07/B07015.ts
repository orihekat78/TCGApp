// cards/ct-p07/B07015 遠山和葉＆大岡紅葉 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md, rules/19-special-rules.md, rules/20-color-and-switch.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md, rules/09-cutin-disguise.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【パートナー緑】【宣言】【ターン1】【スリープ】：手札からレベル5か6の【緑】のイベントを1枚まで使用する。\n【自分ターン中】【ターン1】自分の現場に〚カード名［服部平次］〛が登場したとき、自分のデッキのカードを上から4枚見る。その中から【緑】のイベントを1枚まで公開して手札に加え、残りをリムーブエリアに移す。カードを手札に加えた場合、手札を1枚リムーブする。この能力はパートナーエリアでも発動する。
//   【カットイン】AP＋2000

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
    kind: 'sleepSelf'
  },
  effect: {
    kind: 'atom',
    verb: 'useEventFromHand',
    args: {
      player: 'self',
      max: 1,
      filter: {
        levelMin: 5,
        levelMax: 6,
        color: '緑',
        kind: 'event'
      }
    }
  },
  description: '【パートナー緑】【宣言】【ターン1】【スリープ】：手札からレベル5か6の【緑】のイベントを1枚まで使用する。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-partner-area',
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      payloadKey: 'uid',
      filter: {
        cardName: '服部平次'
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
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          maxN: 4,
          filter: {
            color: '緑',
            kind: 'event'
          },
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
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'handAddFromDeck',
              args: {
                player: 'self',
                cardId: '$matched.cardId'
              }
            },
            {
              kind: 'atom',
              verb: 'discard',
              args: {
                player: 'self',
                n: 1
              }
            }
          ]
        }
      },
      {
        kind: 'atom',
        verb: 'boundToRemove',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      }
    ]
  },
  description: '【自分ターン中】【ターン1】自分の現場に〚カード名［服部平次］〛が登場したとき、自分のデッキのカードを上から4枚見る。その中から【緑】のイベントを1枚まで公開して手札に加え、残りをリムーブエリアに移す。カードを手札に加えた場合、手札を1枚リムーブする。この能力はパートナーエリアでも発動する。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
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

export const B07015: CardDef = {
  id: 'B07015',
  no: '0747/B07015',
  kind: 'character',
  names: [
    '遠山和葉＆大岡紅葉'
  ],
  colors: [
    '緑'
  ],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: [
    '高校生'
  ],
  rarity: 'MR',
  imageUrl: '1758249671488232.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ],
};
