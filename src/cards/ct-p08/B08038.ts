// cards/ct-p08/B08038 京極真 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【自分ターン中】このキャラがコンタクトしたとき、自分のデッキのカードを上から2枚リムーブしてもよい。この効果によって〚特徴［高校生］〛か〚［鈴木財閥］〛のキャラがリムーブされた場合、そのコンタクト中、このキャラをAP＋1000する。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'contact:start',
    selfOnly: true
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'mill',
          args: {
            player: 'self',
            n: 2,
            gate: true,
            bind: '$milled'
          }
        },
        {
          kind: 'conditional',
          if: {
            kind: 'boundAnyMatchesFilter',
            bindKey: '$milled',
            filter: {
              trait: [
                '高校生',
                '鈴木財閥'
              ],
              kind: 'character'
            }
          },
          then: {
            kind: 'atom',
            verb: 'charModifyAP',
            args: {
              uid: '$self',
              delta: 1000,
              scope: 'contact'
            }
          }
        }
      ]
    }
  },
  description: '【自分ターン中】このキャラがコンタクトしたとき、自分のデッキのカードを上から2枚リムーブしてもよい。この効果によって〚特徴［高校生］〛か〚［鈴木財閥］〛のキャラがリムーブされた場合、そのコンタクト中、このキャラをAP＋1000する。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B08038: CardDef = {
  id: 'B08038',
  no: '0877/B08038',
  kind: 'character',
  names: [
    '京極真'
  ],
  colors: [
    '白'
  ],
  level: 4,
  ap: 5000,
  lp: 0,
  traits: [
    '高校生',
    '空手家'
  ],
  rarity: 'C',
  imageUrl: '1770731222579590.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
