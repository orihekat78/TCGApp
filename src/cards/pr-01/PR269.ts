// cards/pr-01/PR269 怪盗キッド (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/23-qa-disguise-cutin.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【自分ターン中】自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカード1枚につき、このキャラをAP＋1000する。\n【自分ターン中】【登場時】【変装時】自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカードを1枚リムーブしてもよい。そうした場合、レベル7以下のスリープ状態かスタン状態のキャラを1枚まで選び、リムーブする。
//   【変装】【FILE7】（手札から、コンタクト中のキャラと入れ替わる。入れ替わったキャラはデッキの下に移す）

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'self'
  },
  continuousModifier: {
    apDelta: {
      dyn: '$self.partnerAreaTraitCount.ビッグジュエル * 1000'
    }
  },
  description: '【自分ターン中】自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカード1枚につき、このキャラをAP＋1000する。',
  ruleRefs: [
    'rules/17-icons.md',
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
          verb: 'partnerAreaRemove',
          args: {
            player: 'self',
            n: 1,
            filter: {
              trait: 'ビッグジュエル'
            }
          }
        },
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            cause: 'effect',
            state: [
              'sleep',
              'stun'
            ],
            filter: {
              levelMax: 7
            }
          }
        }
      ]
    }
  },
  description: '【自分ターン中】【登場時】自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカードを1枚リムーブしてもよい。そうした場合、レベル7以下のスリープ状態かスタン状態のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'disguise:into',
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
          verb: 'partnerAreaRemove',
          args: {
            player: 'self',
            n: 1,
            filter: {
              trait: 'ビッグジュエル'
            }
          }
        },
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            cause: 'effect',
            state: [
              'sleep',
              'stun'
            ],
            filter: {
              levelMax: 7
            }
          }
        }
      ]
    }
  },
  description: '【自分ターン中】【変装時】自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカードを1枚リムーブしてもよい。そうした場合、レベル7以下のスリープ状態かスタン状態のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md',
    'rules/24-qa-naming-stun.md'
  ]
};

const a4: AbilityDef = {
  id: 'a4',
  type: 'icon-disguise',
  condition: {
    kind: 'fileAtLeast',
    n: 7
  },
  description: '【変装】【FILE7】（手札から、コンタクト中のキャラと入れ替わる。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md'
  ]
};

export const PR269: CardDef = {
  id: 'PR269',
  no: '1054/PR269',
  kind: 'character',
  names: [
    '怪盗キッド'
  ],
  colors: [
    '白'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '怪盗'
  ],
  rarity: 'PR',
  imageUrl: '1774884005689584.jpg',
  abilities: [a1, a2, a3, a4],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md',
    'rules/24-qa-naming-stun.md'
  ],
};
