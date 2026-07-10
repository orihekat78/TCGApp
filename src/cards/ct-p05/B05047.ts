// cards/ct-p05/B05047 怪盗キッド (character) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/23-qa-disguise-cutin.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】【変装時】自分のデッキのカードを上から2枚見て、好きな順番でデッキの上か下に移す。（上と下に1枚ずつ移せる）
//   【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          maxN: 2,
          bind: '$revealed'
        }
      },
      {
        kind: 'atom',
        verb: 'deckPlaceSplitBound',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      }
    ]
  },
  description: '【登場時】自分のデッキのカードを上から2枚見て、好きな順番でデッキの上か下に移す。（上と下に1枚ずつ移せる）',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'disguise:into',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          maxN: 2,
          bind: '$revealed'
        }
      },
      {
        kind: 'atom',
        verb: 'deckPlaceSplitBound',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      }
    ]
  },
  description: '【変装時】自分のデッキのカードを上から2枚見て、好きな順番でデッキの上か下に移す。（上と下に1枚ずつ移せる）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'icon-disguise',
  condition: {
    cs: [
      {
        color: '白',
        kind: 'caseColor'
      },
      {
        kind: 'fileAtLeast',
        n: 6
      }
    ],
    kind: 'and'
  },
  description: '【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md'
  ]
};

export const B05047: CardDef = {
  id: 'B05047',
  no: '0549/B05047',
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
  rarity: 'R',
  imageUrl: '1745322205502781.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
