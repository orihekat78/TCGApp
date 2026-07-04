// cards/pr-01/PR282 大和敢助 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【絆諸伏高明】【自分ターン中】LP＋1\n【登場時】カードを1枚引き、手札を1枚リムーブする。リムーブしたカードが〚特徴［長野県警］〛のキャラの場合、AP8000以下のキャラを1枚まで選び、リムーブする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    cs: [
      {
        cardName: '諸伏高明',
        kind: 'bond'
      },
      {
        kind: 'turn',
        player: 'self'
      }
    ],
    kind: 'and'
  },
  continuousModifier: {
    lpDelta: 1
  },
  description: '【絆諸伏高明】【自分ターン中】LP＋1',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        args: {
          n: 1,
          player: 'self'
        },
        kind: 'atom',
        verb: 'draw'
      },
      {
        args: {
          bind: '$discarded',
          n: 1,
          player: 'self'
        },
        kind: 'atom',
        verb: 'discard'
      },
      {
        if: {
          bindKey: '$discarded',
          filter: {
            trait: '長野県警'
          },
          kind: 'boundMatchesFilter'
        },
        kind: 'conditional',
        then: {
          args: {
            filter: {
              apMax: 8000
            },
            max: 1,
            player: 'self',
            side: 'either'
          },
          kind: 'atom',
          verb: 'sceneRemove'
        }
      }
    ]
  },
  description: '【登場時】カードを1枚引き、手札を1枚リムーブする。リムーブしたカードが〚特徴［長野県警］〛のキャラの場合、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

export const PR282: CardDef = {
  id: 'PR282',
  no: '0500/PR282',
  kind: 'character',
  names: [
    '大和敢助'
  ],
  colors: [
    '黄'
  ],
  level: 8,
  ap: 7000,
  lp: 1,
  traits: [
    '警察',
    '長野県警'
  ],
  rarity: 'PR',
  imageUrl: '1779885194361655.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
