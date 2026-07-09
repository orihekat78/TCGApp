// cards/ct-p03/B03110 ジン (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【パートナー黒】自分のターン終了時、自分のFILEエリアにあるカードを上から2枚手札に加えてもよい。そうした場合、手札を2枚リムーブし、このキャラ以外のすべてのキャラをリムーブする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '黒'
      },
      {
        kind: 'turn',
        player: 'self'
      }
    ]
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'filePopToHand',
          args: {
            player: 'self',
            n: 2,
            gate: true
          }
        },
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 2
          }
        },
        {
          kind: 'forEach',
          over: {
            kind: 'all',
            query: {
              area: 'scene',
              side: 'either',
              excludeSelf: true
            }
          },
          do: {
            kind: 'atom',
            verb: 'sceneRemove',
            args: {
              uid: '$each.uid',
              cause: 'effect'
            }
          }
        }
      ]
    }
  },
  description: '【パートナー黒】自分のターン終了時、自分のFILEエリアにあるカードを上から2枚手札に加えてもよい。そうした場合、手札を2枚リムーブし、このキャラ以外のすべてのキャラをリムーブする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B03110: CardDef = {
  id: 'B03110',
  no: '0359/B03110',
  kind: 'character',
  names: [
    'ジン'
  ],
  colors: [
    '黒'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'SR',
  imageUrl: '1729133482942981.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
