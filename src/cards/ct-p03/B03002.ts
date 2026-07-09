// cards/ct-p03/B03002 江戸川コナン (character) — Task A green候補 (engine変更0)
// rules: rules/12-next-hint.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/24-qa-naming-stun.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【ターン1】自分がネクストヒントで手札を使用したとき、自分のデッキのカードを上から3枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。\n【ターン1】自分の現場にいる〚特徴［少年探偵団］〛のキャラが【宣言】能力を使用したとき、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'effect:declared',
    matcherCondition: {
      kind: 'and',
      cs: [
        {
          kind: 'triggerPlayerIs',
          side: 'self'
        },
        {
          kind: 'triggerViaNextHint'
        }
      ]
    }
  },
  limit: {
    kind: 'turn',
    n: 1
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
            trait: '少年探偵団',
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
  description: '【ターン1】自分がネクストヒントで手札を使用したとき、自分のデッキのカードを上から3枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'ability:declared',
    matcherCondition: {
      kind: 'and',
      cs: [
        {
          kind: 'triggerPlayerIs',
          side: 'self'
        },
        {
          kind: 'triggerCharMatches',
          side: 'self',
          filter: {
            trait: '少年探偵団'
          }
        }
      ]
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: {
      uid: '$self',
      kw: '突撃',
      scope: 'turn'
    }
  },
  description: '【ターン1】自分の現場にいる〚特徴［少年探偵団］〛のキャラが【宣言】能力を使用したとき、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B03002: CardDef = {
  id: 'B03002',
  no: '0260/B03002',
  kind: 'character',
  names: [
    '江戸川コナン'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '探偵',
    '毛利探偵事務所',
    '少年探偵団'
  ],
  rarity: 'SR',
  imageUrl: '1729133048228794.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
