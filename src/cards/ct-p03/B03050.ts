// cards/ct-p03/B03050 怪盗キッド (character) — Task A green候補 (engine変更0)
// rules: rules/08-contact.md, rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/23-qa-disguise-cutin.md
// 公式テキスト:
//   【相手ターン中】【変装時】〚カード名［世良真純］〛と入れ替わった場合、このキャラをリムーブしてもよい。そうした場合、証拠を1つ得る。（コンタクト中のキャラが現場を離れた場合、コンタクトは終了する）
//   【変装】【事件白or赤】【FILE5】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'icon-disguise',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseColor',
        color: [
          '白',
          '赤'
        ],
        combine: 'or'
      },
      {
        kind: 'fileAtLeast',
        n: 5
      }
    ]
  },
  description: '【変装】【事件白or赤】【FILE5】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'disguise:into',
    selfOnly: true,
    matcherCondition: {
      kind: 'disguiseReplacedMatches',
      filter: {
        cardName: '世良真純'
      }
    }
  },
  condition: {
    kind: 'turn',
    player: 'opp'
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            uid: '$self',
            cause: 'effect'
          }
        },
        {
          kind: 'atom',
          verb: 'evidenceGain',
          args: {
            player: 'self',
            n: 1
          }
        }
      ]
    }
  },
  description: '【相手ターン中】【変装時】〚カード名［世良真純］〛と入れ替わった場合、このキャラをリムーブしてもよい。そうした場合、証拠を1つ得る。（コンタクト中のキャラが現場を離れた場合、コンタクトは終了する）',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md'
  ]
};

export const B03050: CardDef = {
  id: 'B03050',
  no: '0305/B03050',
  kind: 'character',
  names: [
    '怪盗キッド'
  ],
  colors: [
    '白'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '怪盗'
  ],
  rarity: 'C',
  imageUrl: '1729133385793397.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/23-qa-disguise-cutin.md'
  ],
};
