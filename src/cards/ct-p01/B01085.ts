// cards/ct-p01/B01085 安室透 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   このキャラがアクションしたとき、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、好きな順番でデッキの下に移す）する。レベル5以上のカードが発見された場合、ターン終了時までこのキャラをAP+2000する。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'souza',
        args: {
          player: 'opp',
          x: 1,
          bind: '$found'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'boundAnyMatchesFilter',
          bindKey: '$found',
          filter: {
            levelMin: 5
          }
        },
        then: {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            uid: '$self',
            delta: 2000,
            scope: 'turn'
          }
        }
      }
    ]
  },
  description: 'このキャラがアクションしたとき、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、好きな順番でデッキの下に移す）する。レベル5以上のカードが発見された場合、ターン終了時までこのキャラをAP+2000する。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md'
  ]
};

export const B01085: CardDef = {
  id: 'B01085',
  no: '0073/B01085',
  kind: 'character',
  names: [
    '安室透'
  ],
  colors: [
    '黄'
  ],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [
    '探偵',
    '喫茶ポアロ'
  ],
  rarity: 'C',
  imageUrl: '1714013067531973.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md'
  ],
};
