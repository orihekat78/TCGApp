// cards/ct-p05/B05103 「籌を帷幄の中に運らし…勝ちを千里の外に決す…」 (event) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【パートナー黄】キャラを1枚まで選び、リムーブする。相手の証拠が自分の証拠より2つ以上多い場合、手札を1枚リムーブしてもよい。そうした場合、相手の証拠を1つまで選び、デッキの下に移し、自分は証拠を1つ得る。

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
  condition: {
    kind: 'partnerColor',
    color: '黄'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          cause: 'effect'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'evidenceDiff',
          player: 'opp',
          other: 'self',
          n: 2
        },
        then: {
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
              verb: 'evidenceToDeckBottom',
              args: {
                player: 'opp',
                target: {
                  kind: 'pick',
                  query: {
                    area: 'evidence',
                    side: 'opp'
                  },
                  n: {
                    min: 0,
                    max: 1
                  },
                  chooser: 'self'
                }
              }
            },
            {
              kind: 'atom',
              verb: 'evidenceGain',
              args: {
                player: 'self',
                n: 1
              }
            }
          ]
        }
      }
    ]
  },
  description: '【パートナー黄】キャラを1枚まで選び、リムーブする。相手の証拠が自分の証拠より2つ以上多い場合、手札を1枚リムーブしてもよい。そうした場合、相手の証拠を1つまで選び、デッキの下に移し、自分は証拠を1つ得る。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B05103: CardDef = {
  id: 'B05103',
  no: '0601/B05103',
  kind: 'event',
  names: [
    '「籌を帷幄の中に運らし…勝ちを千里の外に決す…」'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1746628078744592.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
