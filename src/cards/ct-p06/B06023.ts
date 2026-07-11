// cards/ct-p06/B06023 金棒博士 (キャラ) — engine night-wave WC2b (invokeHiramekiOfCard, 2026-07-11)
// rules: 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【登場時】カードを1枚引く。
//   【解決編】【宣言】【ターン1】【スリープ】〚裏向きの証拠を1つ表向きにする〛：この【宣言】能力のコストによって
//     【ヒラメキ】を持つ〚特徴［YAIBA］〛のカードが表向きになった場合、その【ヒラメキ】の効果を発動させてもよい。
// 公式Q&A:
//   - 別エリアへ移動する【ヒラメキ】(ケロ介) も効果通り移動 / 一部だけの解決は不可 (全効果解決)。
//   - 「【ヒラメキ】を発動できない」(世良真純) 場合でも「効果」は発動できる (invoke は発動制限を貫通)。
//   - 有効でない (条件アイコン未達の)【ヒラメキ】も発動できるが何も起こらない (invoke 側 ability.condition skip)。
//   - コスト「裏向きの証拠を1つ表向きにする」は自分の証拠のみ / 好きな場所の証拠を選べる (順番は変えない)。
//
// 句マッピング:
//   a1: 【登場時】カードを1枚引く = triggered{hook:'enter', selfOnly} + draw1 (B06006 型)。
//   a2: 【解決編】【宣言】【ターン1】= declared + condition{caseStatus:'解決編'} + limit{turn,n:1}。
//       【スリープ】= cost item {sleepSelf}。〚裏向きの証拠を1つ表向きにする〛= cost item
//         {flipFaceUpEvidence, n:{min:1,max:1}} ("："左=コスト rules/21、自分の証拠 公式Q&A、D08005 同型)。
//       effect = optional{ invokeHiramekiOfCard{cardIds:'$cost.flipFaceUpEvidence.ids', trait:'YAIBA', player:'self'} }
//         — 「この【宣言】能力のコストによって【ヒラメキ】を持つ〚YAIBA〛のカードが表向きになった場合、その
//         【ヒラメキ】の効果を発動させてもよい」。cost が表向きにした cardId (=$cost.flipFaceUpEvidence.ids、
//         pay.ts WC2b で記録) を invoke。optional=「してもよい」、trait='YAIBA'=印字 gate、非YAIBA/hirameki無は no-op。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【登場時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【解決編】(未達 = 能力を持たない扱い rules/17) + 【ターン1】
  condition: { kind: 'caseStatus', status: '解決編' },
  limit: { kind: 'turn', n: 1 },
  // 【スリープ】+〚裏向きの証拠を1つ表向きにする〛(すべて行う rules/21)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'flipFaceUpEvidence', n: { min: 1, max: 1 } },
    ],
  },
  effect: {
    kind: 'optional',
    effect: { kind: 'atom', verb: 'invokeHiramekiOfCard', args: { cardIds: '$cost.flipFaceUpEvidence.ids', trait: 'YAIBA', player: 'self' } },
  },
  description:
    '【解決編】【宣言】【ターン1】【スリープ】〚裏向きの証拠を1つ表向きにする〛：この【宣言】能力のコストによって【ヒラメキ】を持つ〚特徴［YAIBA］〛のカードが表向きになった場合、その【ヒラメキ】の効果を発動させてもよい。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B06023: CardDef = {
  id: 'B06023',
  no: '0646/B06023',
  kind: 'character',
  names: ['金棒博士'],
  colors: ['緑'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285189394386.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
