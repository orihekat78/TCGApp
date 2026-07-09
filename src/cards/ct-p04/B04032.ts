// cards/ct-p04/B04032 白馬探 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   自分の現場に〚特徴［探偵］〛のキャラが5枚以上いる場合、このキャラをLP＋1する。\n【宣言】【ターン1】〚捜査2〛（相手はデッキのカードを上から指定の数だけ公開し、好きな順番でデッキの下に移す）する。レベル5以上のカードが発見された場合、このキャラ以外のレベル7以下の〚特徴［探偵］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'sceneHas',
    query: {
      area: 'scene',
      side: 'self',
      filter: {
        trait: '探偵'
      }
    },
    nMin: 5
  },
  continuousModifier: {
    lpDelta: 1
  },
  description: '自分の現場に〚特徴［探偵］〛のキャラが5枚以上いる場合、このキャラをLP＋1する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'souza',
        args: {
          player: 'opp',
          x: 2,
          bind: '$found'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'boundAnyMatchesFilter',
          bindKey: '$found',
          filter: {
            levelMin: 5
          }
        },
        then: {
          kind: 'atom',
          verb: 'charGrantKeyword',
          args: {
            player: 'self',
            side: 'either',
            excludeSelf: true,
            max: 1,
            filter: {
              kind: 'character',
              trait: '探偵',
              levelMax: 7
            },
            kw: '突撃',
            scope: 'turn'
          }
        }
      }
    ]
  },
  description: '【宣言】【ターン1】〚捜査2〛（相手はデッキのカードを上から指定の数だけ公開し、好きな順番でデッキの下に移す）する。レベル5以上のカードが発見された場合、このキャラ以外のレベル7以下の〚特徴［探偵］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B04032: CardDef = {
  id: 'B04032',
  no: '0430/B04032',
  kind: 'character',
  names: [
    '白馬探'
  ],
  colors: [
    '白'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'R',
  imageUrl: '1735287759468758.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
