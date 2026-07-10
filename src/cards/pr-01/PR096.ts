// cards/pr-01/PR096 安室透 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚特徴［喫茶ポアロ］〛のキャラが登場したとき、相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。\n【パートナー黄】【宣言】【スリープ】〚デッキのカードを上から5枚リムーブする〛：この【宣言】能力のコストによって〚特徴［探偵］〛のキャラがリムーブされた場合、レベル8以下のキャラを1枚まで選び、リムーブする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      payloadKey: 'uid',
      excludeSource: true,
      filter: {
        trait: '喫茶ポアロ',
        kind: 'character'
      }
    }
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyLevel',
    args: {
      player: 'self',
      max: 1,
      side: 'opp',
      delta: -1,
      scope: 'turn'
    }
  },
  description: '【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚特徴［喫茶ポアロ］〛のキャラが登場したとき、相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '黄'
  },
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepSelf'
      },
      {
        kind: 'removeDeckTop',
        player: 'self',
        n: 5
      }
    ]
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'costRemovedMatches',
      filter: {
        trait: '探偵'
      },
      n: 1
    },
    then: {
      kind: 'atom',
      verb: 'sceneRemove',
      args: {
        player: 'self',
        max: 1,
        side: 'either',
        cause: 'effect',
        filter: {
          levelMax: 8
        }
      }
    }
  },
  description: '【パートナー黄】【宣言】【スリープ】〚デッキのカードを上から5枚リムーブする〛：この【宣言】能力のコストによって〚特徴［探偵］〛のキャラがリムーブされた場合、レベル8以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/17-icons.md'
  ]
};

export const PR096: CardDef = {
  id: 'PR096',
  no: '0484/PR096',
  kind: 'character',
  names: [
    '安室透'
  ],
  colors: [
    '黄'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '探偵',
    '喫茶ポアロ'
  ],
  rarity: 'PR',
  imageUrl: '1954256c825224.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
