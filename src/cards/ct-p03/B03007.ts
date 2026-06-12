// cards/ct-p03/B03007 赤木英雄 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md, rules/10-action-event.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から4枚見る。その中からイベントを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【登場時】上から4枚見てイベント1枚まで手札→残りデッキ下→加えた場合手札1枚リムーブ => enter→deckRevealUntil{kind:event,maxN:4}→(handAddFromDeck→discard1)→deckToBottomBound [D01013 同型 (discard chain)]
//   - 【ヒラメキ】カードを1枚引く => evidence:remove-by-action(optional)→draw [B01011 a2 / D08013]

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
          filter: {
            kind: 'event'
          },
          maxN: 4,
          bind: '$revealed',
          bindMatch: '$matched'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'bound',
          key: '$matched',
          presence: 'matched'
        },
        then: {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'handAddFromDeck',
              args: {
                player: 'self',
                cardId: '$matched.cardId'
              }
            },
            {
              kind: 'atom',
              verb: 'discard',
              args: {
                player: 'self',
                n: 1
              }
            }
          ]
        }
      },
      {
        kind: 'atom',
        verb: 'deckToBottomBound',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      }
    ]
  },
  description: '【登場時】デッキ上から4枚見る → イベントを1枚まで手札(取った場合 discard 1) → 残りをデッキ下。',
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
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B03007: CardDef = {
  id: 'B03007',
  no: '0265/B03007',
  kind: 'character',
  names: [
    '赤木英雄'
  ],
  colors: [
    '青'
  ],
  level: 4,
  ap: 5000,
  lp: 0,
  traits: [
    'サッカー選手'
  ],
  rarity: 'C',
  imageUrl: '1729133048271706.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
    'rules/10-action-event.md'
  ],
};
