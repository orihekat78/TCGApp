// cards/ct-p03/B03024 「新一!!!」 (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/23-qa-disguise-cutin.md, rules/03-field-areas.md
// 公式テキスト:
//   自分の現場にいるレベル8以下のキャラを1枚デッキの下に移してもよい。そうした場合、相手の現場にいるレベル8以下のキャラを1枚まで選び、デッキの下に移し、手札からレベル6以下の【青】のキャラを1枚までスリープ状態で登場させる。

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
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneToDeck',
        args: {
          player: 'self',
          side: 'self',
          max: 1,
          pos: 'bottom',
          filter: {
            levelMax: 8
          }
        }
      },
      {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            verb: 'sceneToDeck',
            args: {
              player: 'self',
              side: 'opp',
              max: 1,
              pos: 'bottom',
              filter: {
                levelMax: 8
              }
            }
          },
          {
            kind: 'atom',
            verb: 'sceneEnter',
            args: {
              player: 'self',
              from: 'hand',
              max: 1,
              viaEffect: true,
              enterSleep: true,
              filter: {
                color: '青',
                levelMax: 6,
                kind: 'character'
              }
            }
          }
        ]
      }
    ]
  },
  description: '自分の現場にいるレベル8以下のキャラを1枚デッキの下に移してもよい。そうした場合、相手の現場にいるレベル8以下のキャラを1枚まで選び、デッキの下に移し、手札からレベル6以下の【青】のキャラを1枚までスリープ状態で登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/23-qa-disguise-cutin.md',
    'rules/03-field-areas.md'
  ]
};

export const B03024: CardDef = {
  id: 'B03024',
  no: '0282/B03024',
  kind: 'event',
  names: [
    '「新一!!!」'
  ],
  colors: [
    '青'
  ],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133201275538.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/23-qa-disguise-cutin.md',
    'rules/03-field-areas.md'
  ],
};
