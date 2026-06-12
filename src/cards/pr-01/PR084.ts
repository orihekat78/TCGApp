// cards/pr-01/PR084 妃英理 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md, rules/09-cutin-disguise.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から1枚見る。その中から〚特徴［毛利探偵事務所］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
// 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】上から1枚見て特徴[毛利探偵事務所]キャラ1枚まで手札、残りデッキ下 => turn:opp + leave:to-remove(selfOnly)→deckRevealUntil{trait:毛利探偵事務所,kind:character,maxN:1}→handAddFromDeck→deckToBottomBound [B01013 look + leave:to-remove hook]
//   - 【カットイン】AP＋1000 => effect:declared(on-hand,optional,selfOnly)→charModifyAP{$contact.byUid,+1000,contact} [D01010 a2]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
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
            trait: '毛利探偵事務所',
            kind: 'character'
          },
          maxN: 1,
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
  description: '【相手ターン中】【現場リムーブ時】デッキ上から1枚見る → 特徴[毛利探偵事務所]キャラを1枚まで手札 → 残りをデッキ下。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
  condition: {
    kind: 'turn',
    player: 'opp'
  }
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$contact.byUid',
      delta: 1000,
      scope: 'contact'
    }
  },
  description: '【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const PR084: CardDef = {
  id: 'PR084',
  no: '0480/PR084',
  kind: 'character',
  names: [
    '妃英理'
  ],
  colors: [
    '青'
  ],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: [
    '弁護士'
  ],
  rarity: 'PR',
  imageUrl: '1737462993147544.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ],
};
