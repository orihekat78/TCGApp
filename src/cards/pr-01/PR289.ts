// cards/pr-01/PR289 円谷光彦 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/16-card-set.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md, rules/25-qa-effects-resolution.md
// 公式テキスト:
//   〚突撃〛（名乗り状態でもアクションできる）\n【FILE7】【ターン1】このキャラのアクション終了時、このキャラの下にカードが重なっている場合、手札を1枚リムーブしてもよい。そうした場合、このキャラをアクティブにする。\n【宣言】【ターン1】〚現場にいるこのキャラ以外の特徴［少年探偵団］のキャラを1枚このキャラの下に重ねる〛：カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:end',
    selfOnly: true
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'fileAtLeast',
        n: 7
      },
      {
        kind: 'stackedCountAtLeast',
        ref: {
          kind: 'self'
        },
        n: 1
      }
    ]
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          max: 1
        }
      },
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          uid: '$self',
          state: 'active'
        }
      }
    ]
  },
  description: '【FILE7】【ターン1】このキャラのアクション終了時、このキャラの下にカードが重なっている場合、手札を1枚リムーブしてもよい。そうした場合、このキャラをアクティブにする。',
  ruleRefs: [
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/25-qa-effects-resolution.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'sceneStackUnderSelf',
    n: 1,
    target: {
      kind: 'pick',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          kind: 'character',
          trait: '少年探偵団'
        },
        excludeSelf: true
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    }
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【宣言】【ターン1】〚現場にいるこのキャラ以外の特徴［少年探偵団］のキャラを1枚このキャラの下に重ねる〛：カードを1枚引く。',
  ruleRefs: [
    'rules/16-card-set.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const PR289: CardDef = {
  id: 'PR289',
  no: '1060/PR289',
  kind: 'character',
  names: [
    '円谷光彦'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: [
    '少年探偵団'
  ],
  rarity: 'PR',
  imageUrl: '1779885194402942.jpg',
  keywords: [
    '突撃'
  ],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
    'rules/25-qa-effects-resolution.md'
  ],
};
