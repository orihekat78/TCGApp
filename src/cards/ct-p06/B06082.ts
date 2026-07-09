// cards/ct-p06/B06082 「説得するよりこの方が早い…」 (event) — Task A green候補 (engine変更0)
// rules: rules/12-next-hint.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/10-action-event.md, rules/14-refresh.md
// 公式テキスト:
//   【解決編】AP8000以下のキャラを1枚まで選び、リムーブする。自分のFILEエリアにあるカードを上から1枚手札に加えてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。（自分の事件が解決編になっている場合、この能力か効果を使える）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  condition: {
    kind: 'caseStatus',
    status: '解決編'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          cause: 'effect',
          filter: {
            apMax: 8000
          }
        }
      },
      {
        kind: 'optional',
        effect: {
          kind: 'chain',
          steps: [
            {
              kind: 'atom',
              verb: 'filePopToHand',
              args: {
                player: 'self'
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
                filter: {
                  apMax: 8000
                }
              }
            }
          ]
        }
      }
    ]
  },
  description: '【解決編】AP8000以下のキャラを1枚まで選び、リムーブする。自分のFILEエリアにあるカードを上から1枚手札に加えてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。（自分の事件が解決編になっている場合、この能力か効果を使える）',
  ruleRefs: [
    'rules/12-next-hint.md',
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

export const B06082: CardDef = {
  id: 'B06082',
  no: '0702/B06082',
  kind: 'event',
  names: [
    '「説得するよりこの方が早い…」'
  ],
  colors: [
    '赤'
  ],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1754285244579440.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ],
};
