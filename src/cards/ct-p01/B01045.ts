// cards/ct-p01/B01045 中森青子 (character) — Task A green候補 (engine変更0)
// rules: rules/11-reasoning.md, rules/07-action-flow.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/22-qa-action-contact.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）\n【ターン1】相手の現場にいるキャラが推理かアクションしたとき、自分のデッキのカードを上から5枚リムーブしてもよい。そうした場合、ターン終了時までそのキャラを元のLPを0にし、元のAPを0にする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'icon-misread',
  scope: 'on-scene',
  effect: {
    args: {
      kind: 'misread-marker',
      x: 1
    },
    kind: 'atom',
    verb: 'noop'
  },
  description: '〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）',
  ruleRefs: [
    'rules/13-keywords.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'reasoning:after-sleep',
    hooks: [
      'action:declare'
    ],
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'opp',
      filter: {}
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'mill',
          args: {
            player: 'self',
            n: 5,
            gate: true
          }
        },
        {
          kind: 'atom',
          verb: 'charOverrideLP',
          args: {
            uid: '$trigger.uid',
            val: 0,
            scope: 'turn'
          }
        },
        {
          kind: 'atom',
          verb: 'charOverrideAP',
          args: {
            uid: '$trigger.uid',
            val: 0,
            scope: 'turn'
          }
        }
      ]
    }
  },
  description: '【ターン1】相手の現場にいるキャラが推理かアクションしたとき、自分のデッキのカードを上から5枚リムーブしてもよい。そうした場合、ターン終了時までそのキャラを元のLPを0にし、元のAPを0にする。',
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/07-action-flow.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B01045: CardDef = {
  id: 'B01045',
  no: '0037/B01045',
  kind: 'character',
  names: [
    '中森青子'
  ],
  colors: [
    '白'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'SR',
  imageUrl: '1714013020311377.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
