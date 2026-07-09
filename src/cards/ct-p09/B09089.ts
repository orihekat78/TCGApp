// cards/ct-p09/B09089 刑事だらけの店 (event) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   AP8000以下のキャラを1枚まで選び、リムーブする。このターン中、自分の現場にキャラが登場していない場合、自分のリムーブエリアにあるレベル4以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。

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
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          filter: {
            apMax: 8000
          }
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'enterCountAtMost',
          player: 'self',
          n: 0
        },
        then: {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'remove',
            max: 1,
            viaEffect: true,
            filter: {
              trait: '警察',
              levelMax: 4,
              kind: 'character'
            }
          }
        }
      }
    ]
  },
  description: 'AP8000以下のキャラを1枚まで選び、リムーブする。このターン中、自分の現場にキャラが登場していない場合、自分のリムーブエリアにあるレベル4以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B09089: CardDef = {
  id: 'B09089',
  no: '1029/B09089',
  kind: 'event',
  names: [
    '刑事だらけの店'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1775608926340876.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
