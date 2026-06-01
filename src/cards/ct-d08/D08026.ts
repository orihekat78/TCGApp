// cards/ct-d08/D08026 青の古城探索事件 (事件)
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
// spec: .claude/specs/cards-analysis/D08026.md
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ以上表向きにする〛:
//     〚特徴［少年探偵団］〛のキャラを1枚まで選び、表向きにした証拠1つにつき、
//     ターン終了時までAP＋1000する。
//
// 先攻7 / 後攻6 (rules/01) — caseLevel は先攻基準。
// a1: inline triggered — 解決編 (case:to-resolved hook) になったとき discard self n=1
// a2: inline declared — 〚証拠表向き〛コストで 特徴[少年探偵団] を 表向き枚数×AP＋1000 (ターン終了まで)

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。
// D08013 と同様の inline triggered ability 形 (case:to-resolved hook で発火 / discard atom 短縮形)。
// ※ 解決編移行時の hook emit は mutate.case.toResolved に集約 (BUG-089)。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always', // 事件カードは case area 所在 → case:to-resolved hook + selfOnly で gate
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true, // 自分の事件カードが解決編になったときのみ発火 (source.uid===card.uid で gate / 相手の事件には誤発火しない)
  },
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

// a2: 【解決編】【宣言】【ターン1】〚裏向き証拠を1つ以上表向きにする〛コストで
//     特徴[少年探偵団] のキャラ1枚を、表向きにした証拠枚数 × AP+1000 (ターン終了時まで)。
// a1 と同様 caseDeclaredEvidenceFlip を inline 展開 (factory 非経由)。
// dyn `$cost.flipFaceUpEvidence.count * 1000`: コスト支払いで積まれた表向き枚数を乗算
//   ($ prefix 必須 / resolve-picks の dyn-arg 解決で human-pick 前に literal 化 — BUG-085)。
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  // 事件カードは case area 所在 → 'on-scene' だと declared 列挙で弾かれるため 'always'。
  // 条件 caseStatus:'解決編' で gate (user_request 20260522_01 #5)。
  scope: 'always',
  condition: { kind: 'caseStatus', status: '解決編' },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 1, max: Infinity } },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          uid: '$pick',
          delta: { dyn: '$cost.flipFaceUpEvidence.count * 1000' },
          scope: 'turn',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'self', filter: { trait: '少年探偵団' } },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description: '【解決編】【宣言】【ターン1】〚裏向き証拠を1つ以上表向きにする〛: AP＋1000/コスト',
  ruleRefs: ['rules/01', 'rules/17', 'rules/19', 'rules/21', 'rules/26'],
};

export const D08026: CardDef = {
  id: 'D08026',
  no: '0499/D08026',
  kind: 'case',
  names: ['青の古城探索事件'],
  colors: ['青'],
  traits: [],
  rarity: 'D',
  imageUrl: '1743743100639068.jpg',
  caseLevel: 7,
  caseTraits: ['古城'],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
