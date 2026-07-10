// cards/ct-p07/B07053 ロボット黒羽快斗 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   現場にいるこのキャラは〚カード名［怪盗キッド］〛としても扱う。\n【登場時】手札から〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛を1枚公開してもよい。そうした場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: {
    grantNames: [
      '怪盗キッド'
    ]
  },
  description: '現場にいるこのキャラは〚カード名［怪盗キッド］〛としても扱う。',
  ruleRefs: [
    'rules/19-special-rules.md',
    'rules/24-qa-naming-stun.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'handReveal',
        args: {
          player: 'self',
          max: 1,
          filter: {
            cardName: [
              '黒羽快斗',
              '怪盗キッド'
            ],
            kind: 'character'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$self',
          kw: '突撃',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【登場時】手札から〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛を1枚公開してもよい。そうした場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B07053: CardDef = {
  id: 'B07053',
  no: '0782/B07053',
  kind: 'character',
  names: [
    'ロボット黒羽快斗'
  ],
  colors: [
    '白'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    'ロボット'
  ],
  rarity: 'C',
  imageUrl: '1762414010594496.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
