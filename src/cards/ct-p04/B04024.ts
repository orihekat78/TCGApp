// cards/ct-p04/B04024 服部静華 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から2枚見る。その中から〚特徴［警察］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
// 句マッピング:
//   - 【登場時】上から2枚見て特徴[警察]キャラ1枚まで手札、残りデッキ下 => enter→deckRevealUntil{trait:警察,kind:character,maxN:2}→handAddFromDeck→deckToBottomBound [B01013 同型]

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
            trait: '警察',
            kind: 'character'
          },
          maxN: 2,
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
            cardId: '$matched.cardId'
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
  description: '【登場時】デッキ上から2枚見る → 特徴[警察]キャラを1枚まで手札 → 残りをデッキ下。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B04024: CardDef = {
  id: 'B04024',
  no: '0425/B04024',
  kind: 'character',
  names: [
    '服部静華'
  ],
  colors: [
    '緑'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287737413746.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
