// cards/ct-p05/B05030 遠山銀司郎 (character) — wave codegen-handcount-setevent (engine変更0, partial-ship)
// rules: 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト:
//   〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）
//   【自分ターン中】このキャラにセットされているカード1枚につき、このキャラをAP＋1000する。  ← DEFER (下記)
//   【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//
// 出荷判断: 〚突撃［キャラ］〛(印字 keyword) + 【登場時】set-facedown のみ出荷 (engine変更0)。
//   【自分ターン中】「セットされているカード1枚につきAP+1000」を DEFER。
//   DEFER 理由: set-card 枚数でスケールする継続 AP 修飾を表現する dyn token ($self.setCardCount 相当) が
//     engine に存在しない (src/engine/dyn/eval.ts resolveSelf は sceneTrait/faceUpEvidence/fileCount/ap/lp/uid/cardId のみ)。
//     additive な engine 拡張 (resolveSelf に setCardCount 分岐追加) が必要 → 本 wave (engine変更0) の範囲外。
//     ⚠ a2 は本カードの主眼 (set-facedown との AP シナジー)。faithfulness 上の partial であることを DEFERRED-INDEX に明記。
//   先例: ct-p04/B04059 と同型の partial-ship (継続 passive 1 能力 DEFER + 他能力出荷)。
//
// 句マッピング (出荷分、全句 既存、engine変更0):
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
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
  ],
};
