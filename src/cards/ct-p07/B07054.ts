// cards/ct-p07/B07054 「アイスクリームは……甘いんだぜ!!」　 (event) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/07-action-flow.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【パートナー白】以下から1つ選んで行う。自分の現場に〚カード名［黒羽快斗］〛と〚［中森青子］〛がいる場合、代わりに3つとも行う。（上から順に行う）\n・【白】のキャラを1枚まで選び、ターン終了時までAP＋2000し、〚突撃〛を与える。\n・レベル7以下のスリープ状態のキャラを1枚まで選び、スタンさせる。\n・【白】のキャラを1枚まで選び、ターン終了時まで「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。

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
    color: '白'
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'and',
      cs: [
        {
          kind: 'sceneHas',
          query: {
            area: 'scene',
            side: 'self',
            filter: {
              cardName: '黒羽快斗'
            }
          },
          nMin: 1
        },
        {
          kind: 'sceneHas',
          query: {
            area: 'scene',
            side: 'self',
            filter: {
              cardName: '中森青子'
            }
          },
          nMin: 1
        }
      ]
    },
    then: {
      kind: 'sequence',
      steps: [
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'charModifyAP',
              args: {
                max: 1,
                side: 'either',
                filter: {
                  color: '白'
                },
                delta: 2000,
                scope: 'turn',
                bind: '$picked'
              }
            },
            {
              kind: 'atom',
              verb: 'charGrantKeyword',
              args: {
                uid: '$picked.uid',
                kw: '突撃',
                scope: 'turn'
              }
            }
          ]
        },
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$pick',
            state: 'stun',
            target: {
              kind: 'pick',
              query: {
                area: 'scene',
                side: 'either',
                filter: {
                  levelMax: 7
                },
                state: [
                  'sleep'
                ]
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
          verb: 'charSetTurnEffect',
          args: {
            uid: '$pick',
            key: 'actionTargetsActive',
            val: true,
            target: {
              kind: 'pick',
              query: {
                area: 'scene',
                side: 'either',
                filter: {
                  color: '白'
                }
              },
              n: {
                min: 0,
                max: 1
              },
              chooser: 'self'
            }
          }
        }
      ]
    },
    else: {
      kind: 'choice',
      chooser: 'self',
      options: [
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'charModifyAP',
              args: {
                max: 1,
                side: 'either',
                filter: {
                  color: '白'
                },
                delta: 2000,
                scope: 'turn',
                bind: '$picked'
              }
            },
            {
              kind: 'atom',
              verb: 'charGrantKeyword',
              args: {
                uid: '$picked.uid',
                kw: '突撃',
                scope: 'turn'
              }
            }
          ]
        },
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$pick',
            state: 'stun',
            target: {
              kind: 'pick',
              query: {
                area: 'scene',
                side: 'either',
                filter: {
                  levelMax: 7
                },
                state: [
                  'sleep'
                ]
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
          verb: 'charSetTurnEffect',
          args: {
            uid: '$pick',
            key: 'actionTargetsActive',
            val: true,
            target: {
              kind: 'pick',
              query: {
                area: 'scene',
                side: 'either',
                filter: {
                  color: '白'
                }
              },
              n: {
                min: 0,
                max: 1
              },
              chooser: 'self'
            }
          }
        }
      ]
    }
  },
  description: '【パートナー白】以下から1つ選んで行う。自分の現場に〚カード名［黒羽快斗］〛と〚［中森青子］〛がいる場合、代わりに3つとも行う。（上から順に行う）・【白】のキャラを1枚まで選び、ターン終了時までAP＋2000し、〚突撃〛を与える。・レベル7以下のスリープ状態のキャラを1枚まで選び、スタンさせる。・【白】のキャラを1枚まで選び、ターン終了時まで「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B07054: CardDef = {
  id: 'B07054',
  no: '0783/B07054',
  kind: 'event',
  names: [
    '「アイスクリームは……甘いんだぜ!!」　'
  ],
  colors: [
    '白'
  ],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1759154512412000.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/24-qa-naming-stun.md'
  ],
};
