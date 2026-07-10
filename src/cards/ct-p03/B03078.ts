// cards/ct-p03/B03078 宮野明美 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/10-action-event.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/19-special-rules.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   このキャラはスリープ状態でもガードできる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【青】か【赤】のカードを1枚まで選び、手札に加える。カードを手札に加えた場合、手札を1枚リムーブする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: {
    grantKeywords: () => ['text:sleepGuard']
  },
  description: 'このキャラはスリープ状態でもガードできる。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/24-qa-naming-stun.md'
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
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'handAddFromRemove',
        args: {
          player: 'self',
          max: 1,
          filter: {
            color: [
              '青',
              '赤'
            ]
          }
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
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【青】か【赤】のカードを1枚まで選び、手札に加える。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/19-special-rules.md'
  ]
};

export const B03078: CardDef = {
  id: 'B03078',
  no: '0332/B03078',
  kind: 'character',
  names: [
    '宮野明美'
  ],
  colors: [
    '赤'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133424883829.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/24-qa-naming-stun.md'
  ],
};
