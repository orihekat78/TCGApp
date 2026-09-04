// cards/ct-p07/B07022 沖田総司 (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/07-action-flow.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【登場時】手札から〚特徴［高校生］〛のキャラを1枚公開してもよい。そうした場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。この効果によって【緑】以外の色を持つキャラを公開した場合、ターン終了時までこのキャラをAP＋1000する。

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
        verb: 'handReveal',
        args: {
          player: 'self',
          audience: 'all',
          lifetime: 'presentation',
          max: 1,
          filter: {
            trait: '高校生',
            kind: 'character'
          },
          bind: '$revealed'
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
      },
      {
        kind: 'conditional',
        if: {
          kind: 'boundMatchesFilter',
          bindKey: '$revealed',
          filter: {
            colorNot: '緑'
          }
        },
        then: {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            uid: '$self',
            delta: 1000,
            scope: 'turn'
          }
        }
      }
    ]
  },
  description: '【登場時】手札から〚特徴［高校生］〛のキャラを1枚公開してもよい。そうした場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。この効果によって【緑】以外の色を持つキャラを公開した場合、ターン終了時までこのキャラをAP＋1000する。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B07022: CardDef = {
  id: 'B07022',
  no: '0754/B07022',
  kind: 'character',
  names: [
    '沖田総司'
  ],
  colors: [
    '緑'
  ],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: [
    '高校生'
  ],
  rarity: 'C',
  imageUrl: '1762413976174833.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
