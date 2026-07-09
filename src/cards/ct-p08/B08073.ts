// cards/ct-p08/B08073 高木渉 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【絆佐藤美和子】自分のターン終了時、自分の現場にいるすべてのキャラが〚カード名［佐藤美和子］〛か〚［高木渉］〛の場合、このキャラをアクティブにする。\n【宣言】【スリープ】：このキャラのAP以下のAPのキャラを1枚まで選び、リムーブする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'turn',
        player: 'self'
      },
      {
        kind: 'bond',
        cardName: '佐藤美和子'
      }
    ]
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'not',
      c: {
        kind: 'sceneHas',
        query: {
          area: 'scene',
          side: 'self',
          filter: {
            kind: 'character',
            cardNameNot: [
              '佐藤美和子',
              '高木渉'
            ]
          }
        },
        nMin: 1
      }
    },
    then: {
      kind: 'atom',
      verb: 'sceneSetState',
      args: {
        uid: '$self',
        state: 'active'
      }
    }
  },
  description: '【絆佐藤美和子】自分のターン終了時、自分の現場にいるすべてのキャラが〚カード名［佐藤美和子］〛か〚［高木渉］〛の場合、このキャラをアクティブにする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'sleepSelf'
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
        apMax: {
          dyn: '$self.ap'
        }
      }
    }
  },
  description: '【宣言】【スリープ】：このキャラのAP以下のAPのキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B08073: CardDef = {
  id: 'B08073',
  no: '0910/B08073',
  kind: 'character',
  names: [
    '高木渉'
  ],
  colors: [
    '黄'
  ],
  level: 8,
  ap: 7000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'C',
  imageUrl: '1770731255769944.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ],
};
