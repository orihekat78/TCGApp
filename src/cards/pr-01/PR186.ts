// cards/pr-01/PR186 アンドレ・キャメル (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   このキャラはスリープ状態で登場する。\n【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［FBI］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
// 句マッピング:
//   - このキャラはスリープ状態で登場する => enter(selfOnly)→sceneSetState{$self,sleep} [B01011 a1]
//   - 【登場時】上から3枚見て特徴[FBI]キャラ1枚まで手札→残りデッキ下→加えた場合手札1枚リムーブ => enter→deckRevealUntil{trait:FBI,kind:character,maxN:3}→(handAddFromDeck→discard1)→deckToBottomBound [D01013 同型]

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
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$self',
      state: 'sleep'
    }
  },
  description: 'このキャラはスリープ状態で登場する。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
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
            trait: 'FBI',
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
  description: '【登場時】デッキ上から3枚見る → 特徴[FBI]キャラを1枚まで手札(取った場合 discard 1) → 残りをデッキ下。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const PR186: CardDef = {
  id: 'PR186',
  no: '0731/PR186',
  kind: 'character',
  names: [
    'アンドレ・キャメル'
  ],
  colors: [
    '赤'
  ],
  level: 3,
  ap: 4000,
  lp: 0,
  traits: [
    'FBI'
  ],
  rarity: 'PR',
  imageUrl: '1759195553269458.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
