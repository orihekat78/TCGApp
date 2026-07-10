// cards/ct-p06/B06098 ベルモット＆シェリー (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【宣言】【ターン1】AP8000以下のキャラを1枚まで選び、リムーブする。この能力は自分の現場に〚特徴［黒ずくめの組織］〛のキャラが2枚以上いる場合に宣言できる。\n【宣言】【ターン1】自分のデッキのカードを上から3枚見る。その中から【カットイン】を持つレベル8以下の【黒】のカードを1枚まで公開して手札に加え、残りをリムーブエリアに移す。レベル4以上のカードを手札に加えた場合、手札を1枚リムーブする。この能力は自分の現場に〚特徴［黒ずくめの組織］〛のキャラが2枚以上いる場合に宣言できる。この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'sceneHas',
    nMin: 2,
    query: {
      area: 'scene',
      filter: {
        trait: '黒ずくめの組織'
      },
      side: 'self'
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    args: {
      cause: 'effect',
      filter: {
        apMax: 8000
      },
      max: 1,
      player: 'self',
      side: 'either'
    },
    kind: 'atom',
    verb: 'sceneRemove'
  },
  description: '【宣言】【ターン1】AP8000以下のキャラを1枚まで選び、リムーブする。この能力は自分の現場に〚特徴［黒ずくめの組織］〛のキャラが2枚以上いる場合に宣言できる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  condition: {
    kind: 'sceneHas',
    nMin: 2,
    query: {
      area: 'scene',
      filter: {
        trait: '黒ずくめの組織'
      },
      side: 'self'
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
          maxN: 3,
          filter: {
            keyword: 'カットイン',
            levelMax: 8,
            color: '黒'
          },
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
        verb: 'boundToRemove',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'boundMatchesFilter',
          bindKey: '$matched',
          filter: {
            levelMin: 4
          }
        },
        then: {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        }
      }
    ]
  },
  description: '【宣言】【ターン1】自分のデッキのカードを上から3枚見る。その中から【カットイン】を持つレベル8以下の【黒】のカードを1枚まで公開して手札に加え、残りをリムーブエリアに移す。レベル4以上のカードを手札に加えた場合、手札を1枚リムーブする。この能力は自分の現場に〚特徴［黒ずくめの組織］〛のキャラが2枚以上いる場合に宣言できる。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  effect: {
    args: {
      delta: 2000,
      scope: 'contact',
      uid: '$contact.byUid'
    },
    kind: 'atom',
    verb: 'charModifyAP'
  },
  description: '【カットイン】AP＋2000',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B06098: CardDef = {
  id: 'B06098',
  no: '0715/B06098',
  kind: 'character',
  names: ['ベルモット＆シェリー', 'ベルモット', 'シェリー'], // rules/19 複数名カード (BUG-185 一括分割 2026-07-10)
  colors: [
    '黒'
  ],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'MR',
  imageUrl: '1751538660441549.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
