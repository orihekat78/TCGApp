// cards/ct-p05/B05106 ジン＆ウォッカ (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【パートナー黒】【自分ターン中】【ターン1】相手の現場にいるキャラがリムーブされたとき、AP8000以下のキャラを1枚まで選び、リムーブする。\n【宣言】【ターン1】自分の現場にいるレベル8以下のキャラを1枚リムーブしてもよい。そうした場合、カードを1枚引く。この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    matcherCondition: {
      kind: 'removedCharMatches',
      side: 'opp'
    }
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '黒'
      },
      {
        kind: 'turn',
        player: 'self'
      }
    ]
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
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
  description: '【パートナー黒】【自分ターン中】【ターン1】相手の現場にいるキャラがリムーブされたとき、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'self',
          cause: 'effect',
          filter: {
            kind: 'character',
            levelMax: 8
          }
        }
      },
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'self',
          n: 1
        }
      }
    ]
  },
  description: '【宣言】【ターン1】自分の現場にいるレベル8以下のキャラを1枚リムーブしてもよい。そうした場合、カードを1枚引く。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md'
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

export const B05106: CardDef = {
  id: 'B05106',
  no: '0602/B05106',
  kind: 'character',
  names: [
    'ジン＆ウォッカ'
  ],
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
  imageUrl: '1742972384145756.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md'
  ],
};
