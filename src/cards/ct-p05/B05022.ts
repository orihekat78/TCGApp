// cards/ct-p05/B05022 「オレがついてる!!」 (event) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/19-special-rules.md
// 公式テキスト:
//   相手の現場にいるキャラを好きな数選び、ターン終了時まで元のAPを0にする。

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
        kind: 'atom',
        verb: 'bindPick',
        args: {
          player: 'self',
          side: 'opp',
          bind: '$picked',
          max: 5
        }
      },
      {
        kind: 'forEach',
        over: {
          kind: 'fromBound',
          bindKey: '$picked'
        },
        do: {
          kind: 'atom',
          verb: 'charOverrideAP',
          args: {
            uid: '$each.uid',
            val: 0,
            scope: 'turn'
          }
        }
      }
    ]
  },
  description: '相手の現場にいるキャラを好きな数選び、ターン終了時まで元のAPを0にする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md'
  ]
};

export const B05022: CardDef = {
  id: 'B05022',
  no: '0528/B05022',
  kind: 'event',
  names: [
    '「オレがついてる!!」'
  ],
  colors: [
    '青'
  ],
  level: 4,
  traits: [],
  rarity: 'C',
  imageUrl: '1746628061742543.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md'
  ],
};
