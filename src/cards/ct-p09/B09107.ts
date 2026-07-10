// cards/ct-p09/B09107 犯人たちの犯行 (case) — engine A3 wave (2026-07-11)
// rules: 01-victory-conditions.md, 14-refresh.md, 17-icons.md, 21-declared-ability-cost.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   自分は【事件解決】できない。
//   【解決編】【宣言】【ターン1】〚デッキのカードをすべてリムーブする〛：自分の証拠をすべて表向きにする。
//   自分の証拠に〚特徴［犯人］〛のカードが8枚以上ある場合、相手はゲームに敗北する。
//
// 句マッピング:
//   - 自分は【事件解決】できない => a1 continuous continuousModifier{cannotSolveCase:true}
//       (E3 P53 shipped、read/game.ts cannotSolveCase が canWin/canSolveCase(AI/UI)/isAllowed を gate)
//   - 【解決編】 => condition caseStatus{status:'解決編'} (D08026/D08019 同型)
//   - 【宣言】【ターン1】 => type:'declared' scope:'always' (事件カードは case area 所在) + limit{turn,1}
//   - 〚デッキのカードをすべてリムーブする〛 => cost removeDeckAll{player:'self'}
//       (engine A3 wave: n 固定でない全部リムーブ。公式Q&A: コスト支払時点でリフレッシュ = 効果解決前)
//   - 自分の証拠をすべて表向きにする => evidenceFlip{player:'self', all:true}
//       (E3 P53 shipped、順序不変・faceUp フラグのみ true 化・0 枚 no-op)
//   - 自分の証拠に〚特徴［犯人］〛のカードが8枚以上ある場合 =>
//       conditional if evidenceTraitAtLeast{player:'self', trait:'犯人', n:8}
//       (E3 P53 shipped。公式Q&A: 犯人以外が混在しても犯人だけ計数して8枚以上なら成立)
//   - 相手はゲームに敗北する => opponentLoses{player:'self'} (E3 増分1 shipped、opp 敗北=self 勝者)

import type { AbilityDef, CardDef } from '@/engine/types';

// 自分は【事件解決】できない (通常勝利ルート封鎖、alt-lose のみ残す)
const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  continuousModifier: { cannotSolveCase: true },
  description: '自分は【事件解決】できない。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/17-icons.md'],
};

// 【解決編】【宣言】【ターン1】〚デッキ全部リムーブ〛：証拠全表向き → 特徴[犯人]≥8 で相手敗北
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  // 事件カードは case area 所在 → 'on-scene' だと declared 列挙で弾かれるため 'always' (D08026 同型)
  scope: 'always',
  condition: { kind: 'caseStatus', status: '解決編' },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'removeDeckAll', player: 'self' },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の証拠をすべて表向きにする
      { kind: 'atom', verb: 'evidenceFlip', args: { player: 'self', all: true } },
      // 自分の証拠に特徴[犯人] が8枚以上ある場合、相手はゲームに敗北する
      {
        kind: 'conditional',
        if: { kind: 'evidenceTraitAtLeast', player: 'self', trait: '犯人', n: 8 },
        then: { kind: 'atom', verb: 'opponentLoses', args: { player: 'self' } },
      },
    ],
  },
  description:
    '【解決編】【宣言】【ターン1】〚デッキのカードをすべてリムーブする〛：自分の証拠をすべて表向きにする。自分の証拠に〚特徴［犯人］〛のカードが8枚以上ある場合、相手はゲームに敗北する。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

export const B09107: CardDef = {
  id: 'B09107',
  no: '1046/B09107',
  kind: 'case',
  names: ['犯人たちの犯行'],
  colors: ['黒'],
  caseTraits: [],
  traits: [],
  rarity: 'C',
  imageUrl: '1775608944008645.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
