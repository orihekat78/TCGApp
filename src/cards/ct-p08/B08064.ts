// cards/ct-p08/B08064 白鳥任三郎 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【登場時】このキャラをスリープさせ、手札から〚特徴［警視庁］〛のキャラを1枚公開してもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。\n【宣言】【ターン1】〚このキャラか、レベル7以下の特徴［警視庁］のキャラを1枚デッキの下に移す〛：カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
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
            uid: '$self',
            state: 'sleep'
          }
        },
        {
          kind: 'atom',
          verb: 'handReveal',
          args: {
            player: 'self',
            max: 1,
            filter: {
              trait: '警視庁',
              kind: 'character'
            }
          }
        },
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            cause: 'effect',
            filter: {
              levelMax: 7
            }
          }
        }
      ]
    }
  },
  description: '【登場時】このキャラをスリープさせ、手札から〚特徴［警視庁］〛のキャラを1枚公開してもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
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
    kind: 'sceneToDeckBottom',
    target: {
      kind: 'pick',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          levelMax: 7,
          trait: '警視庁'
        }
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'owner'
    },
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【宣言】【ターン1】〚このキャラか、レベル7以下の特徴［警視庁］のキャラを1枚デッキの下に移す〛：カードを1枚引く。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B08064: CardDef = {
  id: 'B08064',
  no: '0901/B08064',
  kind: 'character',
  names: [
    '白鳥任三郎'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'R',
  imageUrl: '1770731238709618.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
