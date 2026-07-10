// cards/ct-p08/B08082 ピスコ (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【登場時】手札から【現場リムーブ時】を持つキャラを1枚公開してもよい。そうした場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。\n【相手ターン中】【現場リムーブ時】手札から【黒】以外の色を持つキャラを1枚リムーブしてもよい。そうした場合、カードを1枚引く。

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
          max: 1,
          filter: {
            keyword: '現場リムーブ時',
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
  description: '【登場時】手札から【現場リムーブ時】を持つキャラを1枚公開してもよい。そうした場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true
  },
  condition: {
    kind: 'turn',
    player: 'opp'
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
            colorNot: '黒',
            kind: 'character'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'self',
          n: 1
        }
      }
    ]
  },
  description: '【相手ターン中】【現場リムーブ時】手札から【黒】以外の色を持つキャラを1枚リムーブしてもよい。そうした場合、カードを1枚引く。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B08082: CardDef = {
  id: 'B08082',
  no: '0918/B08082',
  kind: 'character',
  names: [
    'ピスコ'
  ],
  colors: [
    '黒'
  ],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'R',
  imageUrl: '1770731255826334.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
