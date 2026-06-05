// cards/ct-p08/B08030 執事になった理由 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ表向きにする〛：自分の現場にいる〚カード名［伊織無我］〛を1枚まで選び、ターン終了時までAP＋2000する。この能力は自分の現場に〚カード名［大岡紅葉］〛がいる場合に宣言できる。
//
// a1: inline triggered — 解決編 (case:to-resolved hook) になったとき discard self n=1 (D08026 a1 同型)
// a2: inline declared — 〚証拠1つ表向き〛コストで [伊織無我] を AP＋2000 (固定) ターン終了まで (現場に[大岡紅葉]在場時のみ宣言可、D11021 a2 同型)
import type { AbilityDef, CardDef } from '@/engine/types';

// a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always',
  trigger: { hook: 'case:to-resolved', selfOnly: true },
  // この事件が解決編になったとき、自分は手札を1枚リムーブする。
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

// a2: 【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ表向きにする〛: [伊織無我] を AP＋2000 (現場に[大岡紅葉]在場時のみ)
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  // 【解決編】かつ 自分の現場に[大岡紅葉]がいる場合に宣言できる
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseStatus', status: '解決編' },
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '大岡紅葉' } }, nMin: 1 },
    ],
  },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 1, max: 1 } },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      // 自分の現場にいる[伊織無我]を1枚まで選び、ターン終了時までAP＋2000する。
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$pick', delta: 2000, scope: 'turn', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '伊織無我' } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
    ],
  },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ表向きにする〛: 現場の[伊織無我]を1枚までAP＋2000 (現場に[大岡紅葉]在場時のみ)。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};

export const B08030: CardDef = {
  id: 'B08030',
  no: '0870/B08030',
  kind: 'case',
  names: ['執事になった理由'],
  colors: ['緑'],
  traits: [],
  rarity: 'C',
  imageUrl: '1770731222531668.jpg',
  caseLevel: 7,
  caseTraits: [],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
