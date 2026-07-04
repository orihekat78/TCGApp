// cards/ct-p04/B04093 コルン (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   自分の現場にいるこのキャラ以外のキャラがコンタクトしたとき、このキャラをスリープさせてもよい。そうした場合、コンタクト中のキャラを1枚まで選び、このコンタクト中、AP＋1000する。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'contact:start',
    matcherCondition: {
      cs: [
        {
          excludeSource: true,
          kind: 'triggerCharMatches',
          payloadKey: 'aUid',
          side: 'self'
        },
        {
          excludeSource: true,
          kind: 'triggerCharMatches',
          payloadKey: 'bUid',
          side: 'self'
        }
      ],
      kind: 'or'
    }
  },
  condition: {
    c: {
      kind: 'charStateIs',
      ref: {
        kind: 'self'
      },
      state: 'sleep'
    },
    kind: 'not'
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
            delta: 1000,
            inContact: true,
            max: 1,
            scope: 'contact'
          },
          kind: 'atom',
          verb: 'charModifyAP'
        }
      ]
    },
    kind: 'optional'
  },
  description: '自分の現場にいるこのキャラ以外のキャラがコンタクトしたとき、このキャラをスリープさせてもよい。そうした場合、コンタクト中のキャラを1枚まで選び、このコンタクト中、AP＋1000する。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B04093: CardDef = {
  id: 'B04093',
  no: '0475/B04093',
  kind: 'character',
  names: [
    'コルン'
  ],
  colors: [
    '黒'
  ],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'C',
  imageUrl: '1735287841327442.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
