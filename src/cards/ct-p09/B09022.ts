// cards/ct-p09/B09022 遠山和葉 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/07-action-flow.md, rules/08-contact.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【パートナー緑】【解決編】【登場時】自分の現場にいるレベル6以上の〚特徴［探偵］〛のキャラを1枚スリープさせ、手札を1枚リムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。この効果によって〚カード名［服部平次］〛か〚［江戸川コナン］〛をスリープさせた場合、カードを1枚引く。\n相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。

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
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '緑'
      },
      {
        kind: 'caseStatus',
        status: '解決編'
      }
    ]
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            player: 'self',
            side: 'self',
            n: 1,
            state: 'sleep',
            filter: {
              kind: 'character',
              trait: '探偵',
              levelMin: 6
            },
            bind: '$slept'
          }
        },
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        },
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            filter: {
              kind: 'character',
              levelMax: 7
            }
          }
        },
        {
          kind: 'conditional',
          if: {
            kind: 'boundMatchesFilter',
            bindKey: '$slept',
            filter: {
              cardName: [
                '服部平次',
                '江戸川コナン'
              ]
            }
          },
          then: {
            kind: 'atom',
            verb: 'draw',
            args: {
              player: 'self',
              n: 1
            }
          }
        }
      ]
    }
  },
  description: '【パートナー緑】【解決編】【登場時】自分の現場にいるレベル6以上の〚特徴［探偵］〛のキャラを1枚スリープさせ、手札を1枚リムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。この効果によって〚カード名［服部平次］〛か〚［江戸川コナン］〛をスリープさせた場合、カードを1枚引く。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove'
  },
  condition: {
    by: 'self',
    cause: 'contact-ap',
    kind: 'removedCharMatches',
    side: 'opp'
  },
  effect: {
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B09022: CardDef = {
  id: 'B09022',
  no: '0966/B09022',
  kind: 'character',
  names: [
    '遠山和葉'
  ],
  colors: [
    '緑'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'R',
  imageUrl: '1775608819073465.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md'
  ],
};
