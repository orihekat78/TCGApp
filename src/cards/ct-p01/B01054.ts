// cards/ct-p01/B01054 寺井黄之助 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】キャラを1枚まで選び、ターン終了時まで元のLPを0にする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
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
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'bindPick',
        args: {
          player: 'self',
          side: 'either',
          bind: '$picked',
          max: 1
        }
      },
      {
        kind: 'forEach',
        over: {
          kind: 'fromBound',
          bindKey: '$picked'
        },
        do: {
          kind: 'atom',
          verb: 'charOverrideLP',
          args: {
            uid: '$each.uid',
            val: 0,
            scope: 'turn'
          }
        }
      }
    ]
  },
  description: '【相手ターン中】【現場リムーブ時】キャラを1枚まで選び、ターン終了時まで元のLPを0にする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B01054: CardDef = {
  id: 'B01054',
  no: '0046/B01054',
  kind: 'character',
  names: [
    '寺井黄之助'
  ],
  colors: [
    '白'
  ],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [],
  rarity: 'C',
  imageUrl: '1714013041163932.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
