// cards/ct-p05/B05078 世良真純 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から4枚見る。その中から〚特徴［赤井家］〛か〚［探偵］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング (B03007 同型 = deck-look-N + 条件付き discard + deckToBottom):
//   - 【登場時】上から4枚見て(赤井家|探偵)キャラ1枚まで手札→残りデッキ下→加えた場合手札1リムーブ
//     => enter→deckRevealUntil{maxN:4,chooseMatch:'upTo',filterAny:[{trait:赤井家,kind:character},{trait:探偵,kind:character}]}
//        →conditional[bound $matched matched: handAddFromDeck→discard1]→deckToBottomBound [B03007 a1 + B03016 filterAny 同型]
//   - filterAny の OR(赤井家,探偵) は cluster16 G2 で deckRevealUntil 経路も honor (atom-handlers.ts:1350-1361)。
//     各枝に kind:'character' (「…のキャラ」, B07020/B03016 同形)。chooseMatch:'upTo' は公式Q&A「条件を満たすカードが
//     あっても手札に加えないことは可能」(TSV qAndA) で 0枚可 = rules/15「1枚まで」。
//   - 【ヒラメキ】カードを1枚引く => evidence:remove-by-action(optional)→draw [B03007 a2 / B01011 a2 同型]

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
          chooseMatch: 'upTo',
          player: 'self',
          filterAny: [
            {
              trait: '赤井家',
              kind: 'character'
            },
            {
              trait: '探偵',
              kind: 'character'
            }
          ],
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
  description: '【登場時】デッキ上から4枚見る → 特徴[赤井家]か[探偵]のキャラを1枚まで手札(取った場合 discard 1) → 残りをデッキ下。',
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

export const B05078: CardDef = {
  id: 'B05078',
  no: '0578/B05078',
  kind: 'character',
  names: [
    '世良真純'
  ],
  colors: [
    '赤'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '探偵',
    '高校生',
    '赤井家'
  ],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322226158267.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
