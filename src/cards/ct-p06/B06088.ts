// cards/ct-p06/B06088 宮本由美 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［警視庁］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
// 句マッピング:
//   - 【登場時】上から3枚見て特徴[警視庁]キャラ1枚まで手札、残りデッキ下 => enter→deckRevealUntil{trait:警視庁,kind:character,maxN:3}→handAddFromDeck→deckToBottomBound [B01013 同型]

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
          filter: {
            trait: '警視庁',
            kind: 'character'
          },
          maxN: 3,
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
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: {
            player: 'self',
            cardId: '$matched.cardId',
            presentation: 'public-selected-card'
          }
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
  description: '【登場時】デッキ上から3枚見る → 特徴[警視庁]キャラを1枚まで手札 → 残りをデッキ下。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B06088: CardDef = {
  id: 'B06088',
  no: '0707/B06088',
  kind: 'character',
  names: [
    '宮本由美'
  ],
  colors: [
    '黄'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'R',
  imageUrl: '1754285244606645.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
