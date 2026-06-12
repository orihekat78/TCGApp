// cards/pr-01/PR061 中森銀三 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md, rules/10-action-event.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から4枚見る。その中から〚特徴［警察］〛か〚特徴［怪盗］〛を持つキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【登場時】上から4枚見て特徴[警察]か[怪盗]キャラ1枚まで手札→残りデッキ下→加えた場合手札1枚リムーブ => enter→deckRevealUntil{trait:[警察,怪盗],kind:character,maxN:4}→(handAddFromDeck→discard1)→deckToBottomBound [D01013 同型 + trait OR]
//   - 【ヒラメキ】カードを1枚引く => evidence:remove-by-action(optional)→draw [B01011 a2]

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
            trait: [
              '警察',
              '怪盗'
            ],
            kind: 'character'
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
  description: '【登場時】デッキ上から4枚見る → 特徴[警察]か[怪盗]キャラを1枚まで手札(取った場合 discard 1) → 残りをデッキ下。',
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

export const PR061: CardDef = {
  id: 'PR061',
  no: '0405/PR061',
  kind: 'character',
  names: [
    '中森銀三'
  ],
  colors: [
    '白'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'PR',
  imageUrl: '1732542002102912.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
    'rules/10-action-event.md'
  ],
};
