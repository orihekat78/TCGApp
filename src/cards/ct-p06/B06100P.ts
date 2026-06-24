// cards/ct-p06/B06100P ベルモット (character) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【登場時】手札から【カットイン】を持つ【黒】のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
// 句マッピング:
//   - 【登場時】手札から【カットイン】を持つ【黒】のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く => triggered enter selfOnly => chain[discard self max:1 filter{keyword:カットイン,color:黒}, draw self 2] [B06100 (base) a1 同型]

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
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          max: 1,
          filter: {
            keyword: 'カットイン',
            color: '黒'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'self',
          n: 2
        }
      }
    ]
  },
  description: '【登場時】手札から【カットイン】を持つ【黒】のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B06100P: CardDef = {
  id: 'B06100P',
  no: '0717/B06100P',
  kind: 'character',
  names: [
    'ベルモット'
  ],
  colors: [
    '黒'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'RP',
  imageUrl: '1755684985585768.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
