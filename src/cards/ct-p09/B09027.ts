// cards/ct-p09/B09027 大岡紅葉 (character) — 夜間 W0 cost-choice UI 解禁 (2026-07-11)
// rules: 03-field-areas.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md,
//        21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【宣言】【ターン1】〚現場にいるキャラに裏向きでセットされているカード1枚か、手札を1枚リムーブする〛：
//     スリープ状態のキャラを1枚まで選び、スタンさせる。
//     （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//
// 句マッピング:
//   - 【宣言】【ターン1】 => type declared + limit {turn,1} (rules/17【ターン①】/ rules/21)
//   - コスト「現場にいるキャラに裏向きでセットされているカード1枚か、手札を1枚リムーブする」
//       => cost choice{items:[removeSetCard{n:1}, removeFromHand{n:1}]}
//          「か」= 択一 (cost.pay case 'choice' + ctx.dyn.costChoice。human 経路は flows.ts 3.6 の
//          ChoicePicker が branch を選択 — 本カードが初 consumer)。
//          removeSetCard は engine が faceDownOnly 固定 (pay.ts) = 「裏向きでセットされている」に一致。
//          公式Q&A「コストでは自分のカードしか使えない」= rules/21「自分の」省略
//          (pay.ts が selfUids filter で担保)。
//   - 「スリープ状態のキャラを1枚まで選び、スタンさせる」
//       => sceneSetState state:'stun' + target pick query.state:['sleep'] side:'either' n:{0,1}
//          (D03004 a1 同型 — PA短縮形は state=新状態/state[]=filter の二重用途につき長形で書く)。
//          「キャラ」(エリア指定なし) = どちらの現場でも可 (rules/15) / 「1枚まで」= 0 可 (rules/15)。
//          スタン特殊挙動 (アクティブ化の代わりにスリープ) は engine 状態機械側 (rules/03/24)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 〚現場にいるキャラに裏向きでセットされているカード1枚か、手札を1枚リムーブする〛
  cost: {
    kind: 'choice',
    items: [
      { kind: 'removeSetCard', n: 1 },
      {
        kind: 'removeFromHand',
        target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
        n: 1,
      },
    ],
  },
  // スリープ状態のキャラを1枚まで選び、スタンさせる (D03004 a1 同型)
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'stun',
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'either', state: ['sleep'] },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description:
    '【宣言】【ターン1】〚現場にいるキャラに裏向きでセットされているカード1枚か、手札を1枚リムーブする〛：スリープ状態のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};

export const B09027: CardDef = {
  id: 'B09027',
  no: '0971/B09027',
  kind: 'character',
  names: ['大岡紅葉'],
  colors: ['緑'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608835777784.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};
