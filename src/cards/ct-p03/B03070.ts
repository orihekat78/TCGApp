// cards/ct-p03/B03070 メアリー (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【ターン1】自分の現場にいるキャラのアクション［事件］によって証拠を得たとき、このキャラをスリープさせてもよい。そうした場合、相手の現場にいるレベル7以下のキャラを1枚まで選び、手札に移す。相手は手札を1枚リムーブする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'evidence:gain',
    matcherCondition: {
      kind: 'triggerCharMatches',
      payloadKey: 'byUid',
      side: 'self'
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'conditional',
    if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
    then: {
      kind: 'optional',
      effect: {
        kind: 'chain',
        steps: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$self',
            state: 'sleep'
          }
        },
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'sceneToHand',
              args: {
                player: 'self',
                max: 1,
                side: 'opp',
                filter: {
                  levelMax: 7
                }
              }
            },
            {
              kind: 'atom',
              verb: 'discard',
              args: {
                player: 'opp',
                n: 1
              }
            }
          ]
        }
        ]
      }
    }
  },
  description: '【ターン1】自分の現場にいるキャラのアクション［事件］によって証拠を得たとき、このキャラをスリープさせてもよい。そうした場合、相手の現場にいるレベル7以下のキャラを1枚まで選び、手札に移す。相手は手札を1枚リムーブする。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B03070: CardDef = {
  id: 'B03070',
  no: '0324/B03070',
  kind: 'character',
  names: [
    'メアリー'
  ],
  colors: [
    '赤'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '赤井家'
  ],
  rarity: 'R',
  imageUrl: '1729133424823148.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ],
};
