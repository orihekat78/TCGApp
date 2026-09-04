// cards/ct-p06/B06065 伝説の玉探し (case) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/24-qa-naming-stun.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   この事件が解決編に移行したとき、自分は手札を1枚リムーブする。\n【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分のリムーブエリアにある〚特徴［YAIBA］〛のイベントを1枚まで選び、手札に加える。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always',
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true
  },
  effect: {
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'discard'
  },
  description: 'この事件が解決編に移行したとき、自分は手札を1枚リムーブする。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: {
    kind: 'caseStatus',
    status: '解決編'
  },
  cost: {
    kind: 'flipFaceUpEvidence',
    n: {
      min: 2,
      max: 2
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        kind: 'event',
        trait: 'YAIBA'
      }
    }
  },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分のリムーブエリアにある〚特徴［YAIBA］〛のイベントを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B06065: CardDef = {
  id: 'B06065',
  no: '0686/B06065',
  kind: 'case',
  names: [
    '伝説の玉探し'
  ],
  colors: [
    '白'
  ],
  // 公式API category1=YAIBA。case TSVのcategory dropをCardDefで永続backfill。
  caseTraits: ['YAIBA'],
  traits: [],
  rarity: 'C',
  imageUrl: '1754285220551800.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
