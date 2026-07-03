// cards/ct-p06/B06006 江戸川コナン (character) — card-authoring vein 解禁 (engine変更0, 2026-07-03)
// rules: 13-keywords.md(突撃), 15-abilities-effects.md, 16-card-set.md(下に重ねる≠セット), 17-icons.md(【解決編】【自分ターン中】【登場時】)
//
// 公式テキスト:
//   【解決編】〚突撃〛（登場したターンからすぐにアクションできる）
//   【自分ターン中】このキャラの下に重なっているカード1枚につき、このキャラをAP＋1000する。
//   【登場時】自分のデッキのカードを上から1枚リムーブする。自分のリムーブエリアにある
//     〚特徴［探偵］〛か〚［少年探偵団］〛のキャラを2枚まで選び、このキャラの下に重ねる。
//
// engine 解禁根拠 (全 primitive 出荷済, 第2gate 実測 2026-07-03):
//   a1 = continuous + condition{caseStatus:解決編} + continuousModifier{grantKeywords:['突撃']}
//        (D08021 a2 と同型、condition のみ stackedCountAtLeast→caseStatus に差替)
//   a2 = continuous + condition{turn:self} + continuousModifier{apDelta:{dyn:'$self.stackedCount * 1000'}}
//        (B05030 apDelta:{dyn:'$self.setCardCount * 1000'} と同型、dyn token 差替のみ)
//   a3 = triggered enter selfOnly + chain[ mill n:1 gate:false, charStackCard pick{remove,kind:char,trait:[探偵|少年探偵団] any-match,0-2} ]
//        (D08021 a1 と同型: trait を配列化(candidates.ts:345 wants.some=any-match)、n.max 5→2、distinctNames 除去、先頭に mill 追加)
//        ※ mill→pick の順: 先にリムーブした1枚が[探偵]/[少年探偵団]なら pick 対象に含まれる (rules/26 mill→remove、chain 逐次)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  continuousModifier: { grantKeywords: () => ['突撃'] },
  description: '【解決編】〚突撃〛',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDelta: { dyn: '$self.stackedCount * 1000' } },
  description: '【自分ターン中】下に重なるカード1枚につき、このキャラをAP＋1000する。',
  ruleRefs: ['rules/16-card-set.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 自分のデッキのカードを上から1枚リムーブする (必須 =「する」ゆえ gate:false、deck0 なら refresh)
      { kind: 'atom', verb: 'mill', args: { player: 'self', n: 1, gate: false } },
      // リムーブエリアの[探偵]/[少年探偵団]キャラを2枚まで選び、このキャラの下に重ねる
      {
        kind: 'atom',
        verb: 'charStackCard',
        args: {
          uid: '$self',
          cardIds: '$pick.cardIds',
          target: {
            kind: 'pick',
            query: {
              area: 'remove',
              side: 'self',
              filter: { kind: 'character', trait: ['探偵', '少年探偵団'] },
            },
            n: { min: 0, max: 2 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description: '【登場時】デッキ上から1枚リムーブ。リムーブの[探偵]か[少年探偵団]を2枚までこのキャラの下に重ねる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

export const B06006: CardDef = {
  id: 'B06006',
  no: '0631/B06006',
  kind: 'character',
  names: ['江戸川コナン'],
  colors: ['青'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1754284680550250.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
  ],
};
