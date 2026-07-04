// cards/pr-01/PR185 京極真 (character) — Task A green候補 (engine変更0)
// rules: rules/21-declared-ability-cost.md, rules/17-icons.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/05-turn-phases.md
// 公式テキスト:
//   【FILE7】【宣言】【ターン1】〚手札から特徴［高校生］のキャラを1枚公開する〛：ターン終了時までこのキャラをAP＋2000し、〚突撃〛（登場したターンからすぐにアクションできる）を持つ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'fileAtLeast',
    n: 7
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'revealFromHand',
        n: 1,
        target: {
          chooser: 'self',
          kind: 'pick',
          n: {
            max: 1,
            min: 1
          },
          query: {
            area: 'hand',
            filter: {
              trait: '高校生',
              kind: 'character'
            },
            side: 'self'
          }
        }
      }
    ]
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          uid: '$self',
          delta: 2000,
          scope: 'turn'
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
  description: '【FILE7】【宣言】【ターン1】〚手札から特徴［高校生］のキャラを1枚公開する〛：ターン終了時までこのキャラをAP＋2000し、〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/17-icons.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/05-turn-phases.md'
  ]
};

export const PR185: CardDef = {
  id: 'PR185',
  no: '0730/PR185',
  kind: 'character',
  names: [
    '京極真'
  ],
  colors: [
    '白'
  ],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: [
    '高校生',
    '空手家'
  ],
  rarity: 'PR',
  imageUrl: '1759195553263283.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/17-icons.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/05-turn-phases.md'
  ],
};
