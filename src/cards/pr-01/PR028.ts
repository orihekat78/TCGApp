// cards/pr-01/PR028 ジョディ・スターリング (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【ターン1】自分の現場にいるキャラのアクション［事件］によって証拠を得たとき、このキャラをスリープさせてもよい。そうした場合、相手は手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）相手は手札を1枚リムーブする。

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
            state: 'sleep',
            uid: '$self'
          }
        },
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            n: 1,
            player: 'opp'
          }
        }
        ]
      }
    }
  },
  description: '【ターン1】自分の現場にいるキャラのアクション［事件］によって証拠を得たとき、このキャラをスリープさせてもよい。そうした場合、相手は手札を1枚リムーブする。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    args: {
      n: 1,
      player: 'opp'
    },
    kind: 'atom',
    verb: 'discard'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）相手は手札を1枚リムーブする。',
  ruleRefs: [
    'rules/10-action-event.md'
  ]
};

export const PR028: CardDef = {
  id: 'PR028',
  no: '0255/PR028',
  kind: 'character',
  names: [
    'ジョディ・スターリング'
  ],
  colors: [
    '赤'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    'FBI'
  ],
  rarity: 'PR',
  imageUrl: '1721703853384516.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ],
};
