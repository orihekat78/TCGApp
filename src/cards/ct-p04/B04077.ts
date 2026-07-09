// cards/ct-p04/B04077 松田陣平 (character) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/07-action-flow.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【解決編】【宣言】【ターン1】〚デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによって〚特徴［警察］〛のキャラがリムーブされた場合、自分の現場にいるキャラを1枚まで選び、ターン終了時まで「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［佐藤美和子］〛を1枚まで選び、手札に加える。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'caseStatus',
    status: '解決編'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'removeDeckTop',
    player: 'self',
    n: 3
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'costRemovedMatches',
      filter: {
        trait: '警察'
      },
      n: 1
    },
    then: {
      kind: 'atom',
      verb: 'charSetTurnEffect',
      args: {
        uid: '$pick',
        key: 'actionTargetsActive',
        val: true,
        target: {
          kind: 'pick',
          query: {
            area: 'scene',
            side: 'self'
          },
          n: {
            min: 0,
            max: 1
          },
          chooser: 'owner'
        }
      }
    }
  },
  description: '【解決編】【宣言】【ターン1】〚デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによって〚特徴［警察］〛のキャラがリムーブされた場合、自分の現場にいるキャラを1枚まで選び、ターン終了時まで「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
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
        cardName: '佐藤美和子'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［佐藤美和子］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/19-special-rules.md'
  ]
};

export const B04077: CardDef = {
  id: 'B04077',
  no: '0462/B04077',
  kind: 'character',
  names: [
    '松田陣平'
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
  imageUrl: '1735287822639314.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ],
};
