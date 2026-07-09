// cards/ct-p05/B05068 赤井務武 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【パートナー赤】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。これによって〚特徴［赤井家］〛のキャラがリムーブされた場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。

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
    kind: 'partnerColor',
    color: '赤'
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
            n: 3,
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
                '赤井家'
              ],
              kind: 'character'
            }
          },
          then: {
            kind: 'atom',
            verb: 'charGrantKeyword',
            args: {
              uid: '$self',
              kw: '突撃',
              scope: 'turn'
            }
          }
        }
      ]
    }
  },
  description: '【パートナー赤】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。これによって〚特徴［赤井家］〛のキャラがリムーブされた場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B05068: CardDef = {
  id: 'B05068',
  no: '0568/B05068',
  kind: 'character',
  names: [
    '赤井務武'
  ],
  colors: [
    '赤'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '赤井家'
  ],
  rarity: 'R',
  imageUrl: '1746628078699956.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
