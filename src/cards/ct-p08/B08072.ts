// cards/ct-p08/B08072 佐藤美和子 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/10-action-event.md, rules/07-action-flow.md
// 公式テキスト:
//   【絆高木渉】【解決編】【登場時】自分の現場にいるすべてのキャラが〚カード名［佐藤美和子］〛か〚［高木渉］〛の場合、このキャラのAP以下のAPのキャラを1枚まで選び、リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［高木渉］〛を1枚まで選び、手札に加える。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'bond',
        cardName: '高木渉'
      },
      {
        kind: 'caseStatus',
        status: '解決編'
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
    }
  },
  description: '【絆高木渉】【解決編】【登場時】自分の現場にいるすべてのキャラが〚カード名［佐藤美和子］〛か〚［高木渉］〛の場合、このキャラのAP以下のAPのキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        cardName: '高木渉'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［高木渉］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/19-special-rules.md'
  ]
};

export const B08072: CardDef = {
  id: 'B08072',
  no: '0909/B08072',
  kind: 'character',
  names: [
    '佐藤美和子'
  ],
  colors: [
    '黄'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'C',
  imageUrl: '1770731255762900.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/10-action-event.md',
    'rules/07-action-flow.md'
  ],
};
