// cards/ct-p06/B06018 鬼丸猛 (character) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/05-turn-phases.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【事件YAIBA】【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル5以下の〚特徴［YAIBA］〛のキャラを1枚まで選び、登場させる。ターン終了時までそのキャラに〚突撃〛（登場したターンからすぐにアクションできる）と「ターン終了時、このキャラが現場にいる場合、このキャラを表向きのまま証拠として得る。」を与える。

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
    kind: 'caseTrait',
    trait: 'YAIBA'
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        },
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$pick.cardId',
            from: 'remove',
            viaEffect: true,
            bind: '$matched',
            target: {
              kind: 'pick',
              query: {
                area: 'remove',
                side: 'self',
                filter: {
                  trait: 'YAIBA',
                  levelMax: 5,
                  kind: 'character'
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
          kind: 'atom',
          verb: 'charGrantKeyword',
          args: {
            uid: '$matched.uid',
            kw: '突撃',
            scope: 'turn'
          }
        },
        {
          kind: 'atom',
          verb: 'charGrantAbility',
          args: {
            uid: '$matched.uid',
            scope: 'turn',
            ability: {
              trigger: {
                hook: 'phase:end:start'
              },
              effect: {
                kind: 'atom',
                verb: 'sceneToEvidence',
                args: {
                  uid: '$self',
                  faceUp: true
                }
              },
              description: 'ターン終了時、このキャラが現場にいる場合、このキャラを表向きのまま証拠として得る。'
            }
          }
        }
      ]
    }
  },
  description: '【事件YAIBA】【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル5以下の〚特徴［YAIBA］〛のキャラを1枚まで選び、登場させる。ターン終了時までそのキャラに〚突撃〛（登場したターンからすぐにアクションできる）と「ターン終了時、このキャラが現場にいる場合、このキャラを表向きのまま証拠として得る。」を与える。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B06018: CardDef = {
  id: 'B06018',
  no: '0641/B06018',
  kind: 'character',
  names: [
    '鬼丸猛'
  ],
  colors: [
    '緑'
  ],
  level: 8,
  ap: 7000,
  lp: 1,
  traits: [
    'YAIBA'
  ],
  rarity: 'R',
  imageUrl: '1754284680619018.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
