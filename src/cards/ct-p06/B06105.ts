// cards/ct-p06/B06105 ブラックインパクト！ (case) — S1 wave (2026-07-11)
// rules: 01-victory-conditions.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md,
//        21-declared-ability-cost.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：相手は手札を1枚リムーブする。
//     この効果によって相手がレベル6以下のカードをリムーブした場合、自分はカードを1枚引く。
//   自分の【黒】のパートナーの【事件解決】能力を以下の能力に書き換える。
//   【解決編】【証拠隠滅】【スリープ】〚証拠を事件レベルの数だけリムーブする〛：相手はゲームに敗北する。
// 公式Q&A:
//   - パートナー【アシスト】で条件成立時、解決編にしないことは不可 (rules/25)。
//   - 【黒】以外のパートナーも一緒に使用可。その場合は書き換えず【事件解決】はそのまま (a3 = partnerColor:黒 gate)。
//   - 「相手がレベル6以下のカードをリムーブした場合、必ずカードを1枚引く」(「引いてもよい」でない = 必須 draw)。
//   - コスト「裏向きの証拠を3つ表向きにする」は自分の証拠のみ / 好きな場所 (順番不変) / 裏証拠2つ以下では使用不可。
//
// 句マッピング:
//   a1: 【解決編になったとき】手札1枚リムーブ = triggered{hook:'case:to-resolved', selfOnly} + discard 短縮形
//       (B06036 a1 同型。「なったとき」表記だが rules/28 エラッタで「移行したとき」と同義)。
//   a2: 【解決編】【宣言】【ターン1】= declared + condition{caseStatus:'解決編'} + limit{turn,n:1}。
//       〚裏向きの証拠を3つ表向きにする〛= cost {kind:'pay', items:[{flipFaceUpEvidence, n:{min:3,max:3}}]}。
//       effect = sequence[
//         discard{player:'opp', n:1, bind:'$discarded'} (chooser 未指定 = 手札所有者 opp が選ぶ =「相手は…リムーブする」),
//         conditional{ if boundMatchesFilter{$discarded, levelMax:6} → draw{player:'self', n:1} } ]。
//       「レベル6以下のカードをリムーブした場合」= discard した cardId (B08048 Q&A: 前段適用後の状態) の
//       印字 level ≤6 判定 (boundMatchesFilter は cond/eval.ts で level honor)。opp 手札0 = bind 未書込 =
//       条件不成立 = draw なし (「リムーブした場合」)。「カード」= 種別問わず (kind filter なし)。
//   a3: 自分の【黒】のパートナーの【事件解決】能力書き換え = continuous + condition{partnerColor:'黒'} +
//       continuousModifier{partnerSolveOverride:true} (B05118/B03135 同 family、E3 増分4 機構)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always',
  trigger: { hook: 'case:to-resolved', selfOnly: true },
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

// a2: 【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: { kind: 'caseStatus', status: '解決編' },
  limit: { kind: 'turn', n: 1 },
  cost: {
    kind: 'pay',
    items: [{ kind: 'flipFaceUpEvidence', n: { min: 3, max: 3 } }],
  },
  effect: {
    kind: 'sequence',
    steps: [
      // 相手は手札を1枚リムーブする (chooser 未指定 = 手札所有者 opp が選ぶ)
      { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1, bind: '$discarded' } },
      // この効果によって相手がレベル6以下のカードをリムーブした場合、自分はカードを1枚引く。
      {
        kind: 'conditional',
        if: { kind: 'boundMatchesFilter', bindKey: '$discarded', filter: { levelMax: 6 } },
        then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：相手は手札を1枚リムーブする。この効果によって相手がレベル6以下のカードをリムーブした場合、自分はカードを1枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

// a3: 自分の【黒】のパートナーの【事件解決】能力を書き換える。
const a3: AbilityDef = {
  id: 'a3',
  type: 'continuous',
  scope: 'always',
  condition: { kind: 'partnerColor', color: '黒' },
  continuousModifier: { partnerSolveOverride: true },
  description:
    '自分の【黒】のパートナーの【事件解決】能力を以下の能力に書き換える。 【解決編】【証拠隠滅】【スリープ】〚証拠を事件レベルの数だけリムーブする〛：相手はゲームに敗北する。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md', 'rules/21-declared-ability-cost.md'],
};

export const B06105: CardDef = {
  id: 'B06105',
  no: '0722/B06105',
  kind: 'case',
  names: ['ブラックインパクト！'],
  colors: ['黒'],
  caseTraits: [],
  traits: [],
  rarity: 'R',
  imageUrl: '1754285264400657.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
