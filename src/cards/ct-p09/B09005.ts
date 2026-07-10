// cards/ct-p09/B09005 本堂瑛祐 (character) — attribution mini-wave ② costPaid (revealFromHand → costRevealedMatches)
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【事件青＆緑】【宣言】【スリープ】〚手札から特徴［探偵］のキャラを1枚公開する〛：レベル7以下のキャラを1枚まで選び、
//   リムーブする。この【宣言】能力のコストによって〚カード名［江戸川コナン］〛か〚［工藤新一］〛を公開していた場合、
//   相手のFILEエリアにあるカードを上から1枚表向きにする。
//
// 句マッピング:
//   - 【事件青＆緑】 => condition caseColor{color:['青','緑'], combine:'and'} (B09021/B09018 同型。rules/17「&」=全色必要)
//   - 【宣言】【スリープ】〚手札から特徴［探偵］のキャラを1枚公開する〛 => type:'declared',
//       cost pay[sleepSelf, revealFromHand{target pick hand self filter{trait:'探偵',kind:'character'} n{1,1} chooser self, n:1}]
//       (B06004 a2 revealFromHand cost 同型。BUG-123: hand char pick は kind:'character' 明示。
//        canPay = 手札に探偵キャラが無ければ宣言不可。pay は no-op reveal = 手札に残す、cost/pay.ts:110)
//   - レベル7以下のキャラを1枚まで選び、リムーブする => sceneRemove 短縮形 {player:'self',max:1,side:'either',filter:{levelMax:7}}
//       (B09021 a1 VERBATIM。エリア指定なしの「キャラ」=どちらの現場でも・自身も可、「1枚まで」=0枚可 rules/15)
//   - この【宣言】能力のコストによって〚カード名［江戸川コナン］〛か〚［工藤新一］〛を公開していた場合 =>
//       conditional if costRevealedMatches{filter:{cardName:['江戸川コナン','工藤新一']}}
//       (attribution mini-wave 2026-07-10。revealFromHand コストで公開した ids を cond/eval.ts:356 が
//        matchOneFilter(印字値) で判定。cardName 配列 = OR、candidates.ts:409-410 split-name rules/19)
//   - 相手のFILEエリアにあるカードを上から1枚表向きにする => fileFlipTop{player:'opp'}
//       (B09021 a2 同型。atom-handlers/core.ts:402、既に表向き/FILE空は no-op、chain break しない。
//        Q&A: 1番上が既に表向きなら「何も起こりません」= no-op。player:'opp' は owner 相対 resolvePlayer)
//   - Q&A「公開した探偵キャラはコスト支払い完了後、効果解決に入る時点で元に戻してよい」= reveal は presence-check のみ

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【事件青＆緑】事件が青と緑の両色を持つ場合のみ能力を持つ (rules/17)
  condition: { kind: 'caseColor', color: ['青', '緑'], combine: 'and' },
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      {
        kind: 'revealFromHand',
        target: {
          kind: 'pick',
          query: {
            area: 'hand',
            side: 'self',
            filter: { trait: '探偵', kind: 'character' },
          },
          n: { min: 1, max: 1 },
          chooser: 'self',
        },
        n: 1,
      },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      // レベル7以下のキャラを1枚まで選び、リムーブする (どちらの現場でも / 自身も可 / 0枚選択可)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } },
      // コストで〚江戸川コナン〛か〚工藤新一〛を公開していた場合、相手FILE 上から1枚表向き
      {
        kind: 'conditional',
        if: { kind: 'costRevealedMatches', filter: { cardName: ['江戸川コナン', '工藤新一'] } },
        then: { kind: 'atom', verb: 'fileFlipTop', args: { player: 'opp' } },
      },
    ],
  },
  description:
    '【事件青＆緑】【宣言】【スリープ】〚手札から特徴［探偵］のキャラを1枚公開する〛：レベル7以下のキャラを1枚まで選び、リムーブする。この【宣言】能力のコストによって〚カード名［江戸川コナン］〛か〚［工藤新一］〛を公開していた場合、相手のFILEエリアにあるカードを上から1枚表向きにする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};

export const B09005: CardDef = {
  id: 'B09005',
  no: '0950/B09005',
  kind: 'character',
  names: ['本堂瑛祐'],
  colors: ['青'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1775608802599190.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
