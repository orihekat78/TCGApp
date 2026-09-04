// cards/ct-p06/B06036 鬼丸天下統一プロジェクト (case) — S1 wave (2026-07-11, invokeHiramekiOfCard $pick.cardId first-consumer)
// rules: 01-victory-conditions.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   この事件が解決編に移行したとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：この【宣言】能力のコストによって
//     表向きになった【ヒラメキ】を持つ〚特徴［YAIBA］〛のカードを1枚まで選び、その【ヒラメキ】の効果を
//     発動させてもよい。
// 公式Q&A:
//   - パートナー【アシスト】で条件成立時、解決編にしないことは不可 (rules/25)。
//   - 別エリアへ移動する【ヒラメキ】(ケロ介) も効果通り移動する。
//   - 「【ヒラメキ】を発動できない」(世良真純) 場合でも invoke は発動制限を貫通する (「効果」を発動)。
//   - 有効でない (条件アイコン未達の)【ヒラメキ】も発動できるが何も起こらない (invoke 側 ability.condition skip)。
//   - コスト「裏向きの証拠を3つ表向きにする」は自分の証拠のみ / 好きな場所の証拠を選べる (順番は変えない) /
//     裏証拠2つ以下では使用不可 (canPay 裏向き≥n.min)。
//
// 句マッピング:
//   a1: 【解決編に移行したとき】手札1枚リムーブ = triggered{hook:'case:to-resolved', selfOnly} + discard 短縮形
//       (B06043/B06065 a1 同文言・同型)。
//   a2: 【解決編】【宣言】【ターン1】= declared + condition{caseStatus:'解決編'} + limit{turn,n:1}。
//       〚裏向きの証拠を3つ表向きにする〛= cost {kind:'pay', items:[{flipFaceUpEvidence, n:{min:3,max:3}}]}
//         (B06023 a2 同型。sleepSelf は無い — case カードにスリープコストなし)。
//       effect = invokeHiramekiOfCard{ cardId:'$pick.cardId', trait:'YAIBA', target pick }。
//         cost で表向き化した証拠集合 ($costFlipped、pay.ts S1 wave) から、faceUp かつ 印字【ヒラメキ】&
//         〚YAIBA〛の証拠を「1枚まで」(n.min:0 = decline 可 = 「してもよい」rules/15) 選び、その cardId の
//         【ヒラメキ】effect を明示発動 (atom-handlers/core.ts $pick.cardId Pattern B、apply-pick が
//         evidence uid → cardId 逆引き)。trait='YAIBA'=印字 gate、非YAIBA/hirameki無/未flip は候補外。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: この事件が解決編に移行したとき、自分は手札を1枚リムーブする。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always',
  trigger: { hook: 'case:to-resolved', selfOnly: true },
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: 'この事件が解決編に移行したとき、自分は手札を1枚リムーブする。',
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
    kind: 'atom',
    verb: 'invokeHiramekiOfCard',
    args: {
      occurrence: '$pick',
      player: 'self',
      trait: 'YAIBA',
      target: {
        kind: 'pick',
        query: {
          area: 'evidence',
          side: 'self',
          faceUp: true,
          fromGroupCards: '$costFlipped',
          filter: { keyword: 'ヒラメキ', trait: 'YAIBA' },
        },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description:
    '【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：この【宣言】能力のコストによって表向きになった【ヒラメキ】を持つ〚特徴［YAIBA］〛のカードを1枚まで選び、その【ヒラメキ】の効果を発動させてもよい。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};

export const B06036: CardDef = {
  id: 'B06036',
  no: '0659/B06036',
  kind: 'case',
  names: ['鬼丸天下統一プロジェクト'],
  colors: ['緑'],
  // 公式API category1=YAIBA。case TSVのcategory dropをCardDefで永続backfill。
  caseTraits: ['YAIBA'],
  traits: [],
  rarity: 'C',
  imageUrl: '1754285189468269.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
