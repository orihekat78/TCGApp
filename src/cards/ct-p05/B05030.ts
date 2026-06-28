// cards/ct-p05/B05030 遠山銀司郎 (character) — fully faithful (session64: setCardCount dyn で a2 解禁)
// rules: 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）
//   【自分ターン中】このキャラにセットされているカード1枚につき、このキャラをAP＋1000する。  ← a2 (session64 解禁)
//   【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//
// 出荷履歴: 当初は a2 を DEFER (set 枚数スケールの継続 AP 修飾を表す dyn token $self.setCardCount 不在、
//   B04059 同型 partial-ship)。session64 で resolveSelf に setCardCount 分岐を additive 追加 → a2 解禁し
//   fully faithful 化。a2 = D08005 a1 (faceUpEvidence) と同型の継続修飾 (rules/24 常時有効型)。
//
// 句マッピング (全句 既存 + setCardCount dyn):
//   〚突撃［キャラ］〛(無条件 印字) => CardDef.keywords: ['突撃[キャラ]'] (B09037/B07017 同型 innate printed keyword。
//     engine action gate src/engine/flow/main/action.ts が kws.includes('突撃[キャラ]') を honor、括弧内は gloss)。
//   【登場時】「デッキ上から1枚裏向きでこのキャラにセット」=> trigger{hook:'enter', selfOnly:true} →
//     charSetCard{uid:'$self', fromDeckTop:true, faceUp:false} (B03061 a1 完全同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1:【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' } },
  description: '【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

// a2:【自分ターン中】このキャラにセットされているカード1枚につき、このキャラをAP＋1000する。
// rules/24「常時有効型」: 発動するものではなく、有効な限り自動でセット枚数に応じ AP+ (公式Q&A)。
// $self.setCardCount dyn (session64 engine additive) でセット枚数を読む。D08005 a1 (faceUpEvidence) 同型。
const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDelta: { dyn: '$self.setCardCount * 1000' } },
  description: '【自分ターン中】このキャラにセットされているカード1枚につき、このキャラをAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/24-qa-naming-stun.md'],
};

export const B05030: CardDef = {
  id: 'B05030',
  no: '0534/B05030',
  kind: 'character',
  names: ['遠山銀司郎'],
  colors: ['緑'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '大阪府警'],
  keywords: ['突撃[キャラ]'],
  rarity: 'R',
  imageUrl: '1746628061753984.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
  ],
};
