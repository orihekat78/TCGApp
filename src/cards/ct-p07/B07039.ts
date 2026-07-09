// cards/ct-p07/B07039 アン王女 (character) — Task A green候補 (engine変更0)
// rules: rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【解決編】【宣言】【ターン1】〚パートナーエリアにある特徴［ビッグジュエル］のカードを1枚リムーブする〛：カードを1枚引く。
// 句マッピング:
//   - 【解決編】【宣言】【ターン1】〚パートナーエリアにある特徴［ビッグジュエル］のカードを1枚リムーブする〛：カードを1枚引く => declared + condition caseStatus 解決編 + limit turn1 + cost partnerAreaRemove{pick partner-area self trait ビッグジュエル, n1} + draw1 [cost kind = 本 wave 新設 (removeAreaToDeckBottom cost 同型)。公式Q&A本カード: コストでは自分のカードのみ → query side self (rules/21)]

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
    kind: 'partnerAreaRemove',
    target: {
      kind: 'pick',
      query: {
        area: 'partner-area',
        side: 'self',
        filter: {
          trait: [
            'ビッグジュエル'
          ]
        }
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    },
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【解決編】【宣言】【ターン1】〚パートナーエリアにある特徴［ビッグジュエル］のカードを1枚リムーブする〛：カードを1枚引く。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B07039: CardDef = {
  id: 'B07039',
  no: '0768/B07039',
  kind: 'character',
  names: [
    'アン王女'
  ],
  colors: [
    '白'
  ],
  level: 3,
  ap: 3000,
  lp: 0,
  traits: [
    '王女'
  ],
  rarity: 'C',
  imageUrl: '1762413994256987.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
