// cards/ct-p08/B08004 江戸川コナン (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/03-field-areas.md
// 公式テキスト:
//   【パートナー青】〚突撃〛（登場したターンからすぐにアクションできる）\n【事件青＆黒】【絆灰原哀】【FILE5】【宣言】【ターン1】〚アクティブ状態のカード名［灰原哀］を1枚スタンさせる〛：このキャラをアクティブにする。この能力は自分のリムーブエリアに【黒】のキャラが3枚以上ある場合に宣言できる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '青'
  },
  continuousModifier: {
    grantKeywords: () => ['突撃']
  },
  description: '【パートナー青】〚突撃〛（登場したターンからすぐにアクションできる）',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseColor',
        color: [
          '青',
          '黒'
        ],
        combine: 'and'
      },
      {
        kind: 'bond',
        cardName: '灰原哀'
      },
      {
        kind: 'fileAtLeast',
        n: 5
      },
      {
        kind: 'removeColorAtLeast',
        player: 'self',
        color: '黒',
        n: 3,
        cardKind: 'character'
      }
    ]
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'stunChar',
    target: {
      kind: 'pick',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          cardName: '灰原哀'
        },
        state: [
          'active'
        ]
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    }
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$self',
      state: 'active'
    }
  },
  description: '【事件青＆黒】【絆灰原哀】【FILE5】【宣言】【ターン1】〚アクティブ状態のカード名［灰原哀］を1枚スタンさせる〛：このキャラをアクティブにする。この能力は自分のリムーブエリアに【黒】のキャラが3枚以上ある場合に宣言できる。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/03-field-areas.md',
    'rules/13-keywords.md'
  ]
};

export const B08004: CardDef = {
  id: 'B08004',
  no: '0845/B08004',
  kind: 'character',
  names: [
    '江戸川コナン'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '探偵',
    '毛利探偵事務所',
    '少年探偵団'
  ],
  rarity: 'R',
  imageUrl: '1766493008967186.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/03-field-areas.md'
  ],
};
