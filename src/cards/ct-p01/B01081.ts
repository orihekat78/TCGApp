// cards/ct-p01/B01081 安室透 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【パートナー黄】【ターン1】自分の現場にいるキャラがアクションしたとき、レベル7以下のキャラを1枚まで選び、デッキの上か下に移す。（自分が上か下かを選ぶ）

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      filter: {}
    }
  },
  condition: {
    kind: 'partnerColor',
    color: '黄'
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
        verb: 'sceneToDeck',
        args: {
          player: 'self',
          side: 'either',
          max: 1,
          pos: 'top',
          filter: {
            levelMax: 7
          }
        }
      },
      {
        kind: 'atom',
        verb: 'sceneToDeck',
        args: {
          player: 'self',
          side: 'either',
          max: 1,
          pos: 'bottom',
          filter: {
            levelMax: 7
          }
        }
      }
    ]
  },
  description: '【パートナー黄】【ターン1】自分の現場にいるキャラがアクションしたとき、レベル7以下のキャラを1枚まで選び、デッキの上か下に移す。（自分が上か下かを選ぶ）',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B01081: CardDef = {
  id: 'B01081',
  no: '0069/B01081',
  kind: 'character',
  names: [
    '安室透'
  ],
  colors: [
    '黄'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '探偵',
    '喫茶ポアロ'
  ],
  rarity: 'SR',
  imageUrl: '1714013067515061.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ],
};
