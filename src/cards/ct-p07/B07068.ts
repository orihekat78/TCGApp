// cards/ct-p07/B07068 羽田秀𠮷 (character) — Task A green候補 (engine変更0)
// rules: rules/17-icons.md, rules/15-abilities-effects.md, rules/03-field-areas.md, rules/20-color-and-switch.md, rules/10-action-event.md, rules/14-refresh.md
// 公式テキスト:
//   【パートナー赤】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル5以下の【赤】のキャラを1枚まで選び、スリープ状態で登場させる。自分の手札が2枚以下の場合、登場させたキャラとこのキャラをアクティブにする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。

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
    kind: 'partnerColor',
    color: '赤'
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'charStateIs',
      ref: {
        kind: 'self'
      },
      state: 'active'
    },
    then: {
      kind: 'optional',
      effect: {
        kind: 'chain',
        steps: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$self',
            state: 'sleep'
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
              verb: 'sceneEnter',
              args: {
                player: 'self',
                cardId: '$pick.cardId',
                viaEffect: true,
                bind: '$entered',
                enterSleep: true,
                target: {
                  kind: 'pick',
                  query: {
                    area: 'remove',
                    side: 'self',
                    filter: {
                      kind: 'character',
                      color: '赤',
                      levelMax: 5
                    }
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
              kind: 'conditional',
              if: {
                kind: 'handAtMost',
                player: 'self',
                n: 2
              },
              then: {
                kind: 'sequence',
                steps: [
                  {
                    kind: 'atom',
                    verb: 'sceneSetState',
                    args: {
                      uid: '$entered.uid',
                      state: 'active'
                    }
                  },
                  {
                    kind: 'atom',
                    verb: 'sceneSetState',
                    args: {
                      uid: '$self',
                      state: 'active'
                    }
                  }
                ]
              }
            }
          ]
        }
        ]
      }
    }
  },
  description: '【パートナー赤】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル5以下の【赤】のキャラを1枚まで選び、スリープ状態で登場させる。自分の手札が2枚以下の場合、登場させたキャラとこのキャラをアクティブにする。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/03-field-areas.md',
    'rules/20-color-and-switch.md'
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
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B07068: CardDef = {
  id: 'B07068',
  no: '0797/B07068',
  kind: 'character',
  names: [
    '羽田秀𠮷'
  ],
  colors: [
    '赤'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '棋士',
    '赤井家'
  ],
  rarity: 'R',
  imageUrl: '1762414010653092.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/03-field-areas.md',
    'rules/20-color-and-switch.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ],
};
