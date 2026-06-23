// cards/pr-01/PR099 工藤有希子 (character) — wave codegen-handcount-setevent (engine変更0, partial-ship)
// rules: 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   a1:【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//        ターン終了時までこのキャラは〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を持つ。
//   a2:【宣言】【ターン1】ターン終了時までこのキャラをAP＋1000する。キャラのカード名を1つ指定し、
//        ターン終了時までこのキャラのカード名を指定したカード名に書き換えてもよい。  ← DEFER (下記)
//
// 出荷判断: a1 のみ出荷 (engine変更0)。a2 は DEFER。
//   a2 DEFER 理由: 「キャラのカード名を1つ指定し…カード名を書き換える」= プレイヤーが全カードプール
//     から任意のカード名を指定する rename 機構が engine に存在しない (renameCardName 系 verb は src/engine に 0 件)。
//     汎用 verb では「任意カード名指定」を誠実に表現できず over/under-fire の懸念 → DEFERRED-INDEX に記録。
//   先例: ct-p04/B04059 (継続 passive a1 DEFER + 他能力出荷) と同型の partial-ship。
//
// 句マッピング (a1、全句 既存 verb、engine変更0):
//   【登場時】=> trigger{hook:'enter', selfOnly:true}, scope:'on-scene' (B03061 a1 同型)。
//   「デッキ上から1枚裏向きでこのキャラにセット」=> charSetCard{uid:'$self', fromDeckTop:true, faceUp:false}
//     (B03061 a1 / B07034 a2 完全同型。離場時リムーブは engine 既定 rules/16)。
//   「ターン終了時まで〚突撃［キャラ］〛を持つ」=> charGrantKeyword{uid:'$self', kw:'突撃[キャラ]', scope:'turn'}
//     (D09027 a1 / B01094 が kw:'突撃[キャラ]' scope:'turn' を実出荷。engine action gate src/engine/flow/main/action.ts
//      が kws.includes('突撃[キャラ]') を honor。scope:'turn'=ターン終了時まで)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1:【登場時】デッキ上端を裏向きセット + ターン終了時まで〚突撃［キャラ］〛付与。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分のデッキのカードを上から1枚裏向きでこのキャラにセットする
      { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' } },
      // ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } },
    ],
  },
  description: '【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const PR099: CardDef = {
  id: 'PR099',
  no: '0486/PR099',
  kind: 'character',
  names: ['工藤有希子'],
  colors: ['白'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['女優'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '195c3640cfa318.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
