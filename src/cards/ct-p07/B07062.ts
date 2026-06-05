// cards/ct-p07/B07062 緋色の誘惑の巻 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛:
//     自分のリムーブエリアにある〚特徴［赤魔術］〛のイベントを1枚まで選び、手札に加える。
//     この能力は自分の現場に〚カード名［小泉紅子］〛がいる場合に宣言できる。
//
// 先攻7 / 後攻6 (rules/01) — caseLevel は先攻基準。
// a1: 解決編 (case:to-resolved hook) になったとき discard self n=1 (D08026 a1 / caseResolvedHandRemove 同型)。
// a2: 【解決編】【宣言】【ターン1】〚証拠2つ表向き〛コストで リムーブの[赤魔術]イベントを1枚手札へ。
//     条件: 解決編 かつ 現場に[小泉紅子]がいる (caseStatus + bond)。handAddFromRemove は D08013 a2 / B05055 a2 同型。

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '@/cards/_shared';

// a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。
const a1: AbilityDef = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  // 事件カードは case area 所在 → 'on-scene' だと declared 列挙で弾かれるため 'always'。
  scope: 'always',
  // 条件 and(caseStatus:'解決編', bond:[小泉紅子]) で gate。
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseStatus', status: '解決編' },
      { kind: 'bond', cardName: '小泉紅子' },
    ],
  },
  limit: { kind: 'turn', n: 1 },
  // 〚裏向きの証拠を2つ表向きにする〛
  cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
  // 自分のリムーブエリアにある[赤魔術]のイベントを1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { trait: '赤魔術' } } },
  description: '【解決編】【宣言】【ターン1】〚裏向き証拠を2つ表向きにする〛: リムーブの[赤魔術]イベントを1枚手札に加える ([小泉紅子]在場時のみ宣言可)。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};

export const B07062: CardDef = {
  id: 'B07062',
  no: '0791/B07062',
  kind: 'case',
  names: ['緋色の誘惑の巻'],
  colors: ['白'],
  traits: [],
  rarity: 'C',
  imageUrl: '1762414010629346.jpg',
  caseLevel: 7,
  caseTraits: [],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
