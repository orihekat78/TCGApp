// cards/ct-p01/B01047 黒羽快斗 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   このキャラのアクション終了時、このキャラを現場からデッキの下に移してもよい。そうした場合、手札からレベル6以下の【白】の〚カード名［黒羽快斗］〛以外のキャラを1枚まで登場させる。ターン終了時までそのキャラに〚突撃〛（登場したターンからすぐにアクションできる）と「ターン終了時、このキャラを現場から手札に移す。」を与える。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:end',
    selfOnly: true
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneToDeck',
          args: {
            uid: '$self',
            pos: 'bottom'
          }
        },
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$pick.cardId',
            from: 'hand',
            viaEffect: true,
            bind: '$matched',
            target: {
              kind: 'pick',
              query: {
                area: 'hand',
                side: 'self',
                filter: {
                  color: '白',
                  levelMax: 6,
                  cardNameNot: '黒羽快斗',
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
                verb: 'sceneToHand',
                args: {
                  uid: '$self'
                }
              },
              description: 'ターン終了時、このキャラを現場から手札に移す。（B01047 付与）'
            }
          }
        }
      ]
    }
  },
  description: 'このキャラのアクション終了時、このキャラを現場からデッキの下に移してもよい。そうした場合、手札からレベル6以下の【白】の〚カード名［黒羽快斗］〛以外のキャラを1枚まで登場させる。ターン終了時までそのキャラに〚突撃〛（登場したターンからすぐにアクションできる）と「ターン終了時、このキャラを現場から手札に移す。」を与える。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B01047: CardDef = {
  id: 'B01047',
  no: '0039/B01047',
  kind: 'character',
  names: [
    '黒羽快斗'
  ],
  colors: [
    '白'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'R',
  imageUrl: '1714013020316188.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md'
  ],
};
