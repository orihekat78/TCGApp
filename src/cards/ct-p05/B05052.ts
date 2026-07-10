// cards/ct-p05/B05052 工藤優作 (character) — 夜間 W0 cost-choice UI 解禁 #2 (2026-07-11)
// rules: 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md,
//        20-color-and-switch.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【絆工藤有希子】【自分ターン中】AP＋3000、〚突撃〛（登場したターンからすぐにアクションできる）
//   【絆工藤新一】【宣言】【ターン1】〚手札を1枚リムーブするか、現場にいるキャラにセットされている
//     カードを1枚リムーブする〛：自分のリムーブエリアにあるレベル3以下のキャラを1枚まで選び、登場させる。
//
// 句マッピング:
//   - a1【絆工藤有希子】【自分ターン中】 => condition and[bond 工藤有希子, turn self]
//     (bond = 現場に指定カード名 rules/17。D09004 a1 同型)
//   - a1「AP＋3000、突撃」 => continuous {apDelta:3000, grantKeywords:['突撃']}
//     (B06006 a1 = condition+grantKeywords 同型 / apDelta 自己修正 D09006 a1 同型)。
//     Q&A「アクション中に絆が切れても継続」= rules/22 アクション継続性 (engine 側)。
//   - a2【絆工藤新一】【宣言】【ターン1】 => declared + condition bond + limit
//   - a2 コスト「手札を1枚リムーブするか、〜セットされているカードを1枚リムーブする」
//       => cost choice{items:[removeFromHand{n:1}, removeSetCard{n:1, anyFace:true}]}
//          「か」= 択一 (flows.ts 3.6 ChoicePicker、B09027 と同経路)。
//          「セットされている」(裏向き限定句なし) = anyFace:true (夜間 W0 engine additive、
//          表裏不問。公式Q&A「コストは自分のカードのみ」= pay.ts selfUids filter)。
//   - a2「自分のリムーブエリアにあるレベル3以下のキャラを1枚まで選び、登場させる」
//       => sceneEnter 短縮形 {from:'remove', max:1, viaEffect, filter:{levelMax:3, kind:'character'}}
//          (「まで」=0可 rules/15 / remove からキャラ pick = kind:'character' BUG-123 /
//          Q&A「現場5枚でも登場可 (スイッチ)」= UI switch-on-effect-enter 経路 rules/20 /
//          Q&A「効果登場でも【登場時】発動」= sceneEnter viaEffect emit)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'bond', cardName: '工藤有希子' },
      { kind: 'turn', player: 'self' },
    ],
  },
  continuousModifier: { apDelta: 3000, grantKeywords: () => ['突撃'] }, // grantKeywords は関数 shape (read/char.ts:441、D08021/B06006 同型)
  description: '【絆工藤有希子】【自分ターン中】AP＋3000、〚突撃〛（登場したターンからすぐにアクションできる）',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  condition: { kind: 'bond', cardName: '工藤新一' },
  // 〚手札を1枚リムーブするか、現場にいるキャラにセットされているカードを1枚リムーブする〛
  cost: {
    kind: 'choice',
    items: [
      {
        kind: 'removeFromHand',
        target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
        n: 1,
      },
      { kind: 'removeSetCard', n: 1, anyFace: true },
    ],
  },
  // 自分のリムーブエリアにあるレベル3以下のキャラを1枚まで選び、登場させる
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      filter: { levelMax: 3, kind: 'character' },
    },
  },
  description:
    '【絆工藤新一】【宣言】【ターン1】〚手札を1枚リムーブするか、現場にいるキャラにセットされているカードを1枚リムーブする〛：自分のリムーブエリアにあるレベル3以下のキャラを1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
  ],
};

export const B05052: CardDef = {
  id: 'B05052',
  no: '0554/B05052',
  kind: 'character',
  names: ['工藤優作'],
  colors: ['白'],
  level: 6,
  ap: 3000,
  lp: 2,
  traits: ['小説家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322205521285.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
