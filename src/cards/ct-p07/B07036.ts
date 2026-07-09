// cards/ct-p07/B07036 中森青子 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/01-victory-conditions.md
// 公式テキスト:
//   【解決編】【登場時】自分の現場にいる【白】のキャラを1枚スリープさせ、手札を1枚リムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。この効果によって〚カード名［黒羽快斗］〛をスリープさせた場合、カードを1枚引く。（自分の事件が解決編になっている場合、この能力か効果を使える）

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  condition: {
    kind: 'caseStatus',
    status: '解決編'
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
            player: 'self',
            state: 'sleep',
            side: 'self',
            filter: {
              color: '白'
            },
            n: 1,
            bind: '$slept'
          }
        },
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        },
        {
          kind: 'sequence',
          steps: [
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
            },
            {
              kind: 'conditional',
              if: {
                kind: 'boundMatchesFilter',
                bindKey: '$slept',
                filter: {
                  cardName: '黒羽快斗'
                }
              },
              then: {
                kind: 'atom',
                verb: 'draw',
                args: {
                  player: 'self',
                  n: 1
                }
              }
            }
          ]
        }
      ]
    }
  },
  description: '【解決編】【登場時】自分の現場にいる【白】のキャラを1枚スリープさせ、手札を1枚リムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。この効果によって〚カード名［黒羽快斗］〛をスリープさせた場合、カードを1枚引く。（自分の事件が解決編になっている場合、この能力か効果を使える）',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/01-victory-conditions.md'
  ]
};

export const B07036: CardDef = {
  id: 'B07036',
  no: '0765/B07036',
  kind: 'character',
  names: [
    '中森青子'
  ],
  colors: [
    '白'
  ],
  level: 6,
  ap: 4000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'R',
  imageUrl: '1762413994239197.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/01-victory-conditions.md'
  ],
};
