// cards/ct-p03/B03080 BANG (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/16-card-set.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   相手に証拠を1つ与えてもよい。このイベントを自分の現場にいる【赤】のキャラ1枚にセットする。\nこのイベントがセットされているキャラは「【ターン1】このキャラがアクション［事件］したとき、このキャラをアクティブにする。」を持つ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'optional',
        effect: {
          kind: 'atom',
          verb: 'evidenceGain',
          args: {
            player: 'opp',
            n: 1
          }
        }
      },
      {
        kind: 'atom',
        verb: 'charSetCard',
        args: {
          player: 'self',
          fromSelf: true,
          n: 1,
          filter: {
            color: '赤',
            kind: 'character'
          }
        }
      }
    ]
  },
  description: '相手に証拠を1つ与えてもよい。このイベントを自分の現場にいる【赤】のキャラ1枚にセットする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-set-host',
  trigger: {
    hook: 'action:declare',
    selfOnly: true,
    matcherCondition: {
      kind: 'triggerActionKind',
      v: 'case'
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$self',
      state: 'active'
    }
  },
  description: 'このイベントがセットされているキャラは「【ターン1】このキャラがアクション［事件］したとき、このキャラをアクティブにする。」を持つ。',
  ruleRefs: [
    'rules/16-card-set.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B03080: CardDef = {
  id: 'B03080',
  no: '0334/B03080',
  kind: 'event',
  names: [
    'BANG'
  ],
  colors: [
    '赤'
  ],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133424904221.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/22-qa-action-contact.md'
  ],
};
