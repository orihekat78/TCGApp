// cards/ct-p08/B08051 赤井秀一 (キャラ) — engine拡張 wave#2 cluster4 (remove-area → deck-bottom, 2026-06-14)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【登場時】自分のリムーブエリアに〚カード名［宮野明美］〛がある場合、ターン終了時までこのキャラは
//     〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//   【宣言】【ターン1】〚リムーブエリアにあるカード名［諸星大］か［ライ］を1枚デッキの下に移す〛：
//     ターン終了時までこのキャラは〚ブレット〛（このキャラのアクションはガードできない）を持つ。
//
// 句マッピング:
//   a1: 【登場時】 => trigger{hook:'enter', selfOnly:true} (D01004/D01006/B09084 a2 同型)。
//       「自分のリムーブエリアに［宮野明美］がある場合」=> condition{kind:'removeNameAtLeast', player:'self',
//         cardName:'宮野明美', n:1} (発動時点で評価。公式Q&A: 登場時の判定時点に無ければ持たない / 後で
//         置かれても持たない)。「ターン終了時までこのキャラは〚突撃〛を持つ」=> charGrantKeyword{uid:'$self',
//         kw:'突撃', scope:'turn'} (D04005 同型, 一回限り grant)。公式Q&A: 突撃を得た後に［宮野明美］が
//         リムーブエリアから無くなっても突撃を失わない => 常時有効 (continuous) ではなく triggered 一回 grant が正。
//   a2: 【宣言】【ターン1】 => declared + limit:{turn,1}。
//       cost 〚リムーブエリアにあるカード名［諸星大］か［ライ］を1枚デッキの下に移す〛 => removeAreaToDeckBottom
//         (cluster4 新 cost。query.side:'self' = rules/21「自分の」省略 + 公式Q&A「相手のカードは移せない」。
//          ［諸星大］［ライ］は別カードの印字名のため cardName OR-filter で両方を候補化。"カード名" 表記=キャラ
//          限定なし → kind 付けない)。
//       「ターン終了時までこのキャラは〚ブレット〛を持つ」=> charGrantKeyword{uid:'$self', kw:'ブレット', scope:'turn'}。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】(このキャラが登場したとき)
  trigger: { hook: 'enter', selfOnly: true },
  // 自分のリムーブエリアに〚カード名［宮野明美］〛がある場合 (発動時点で評価 / rules/17)
  condition: { kind: 'removeNameAtLeast', player: 'self', cardName: '宮野明美', n: 1 },
  // ターン終了時までこのキャラは〚突撃〛を持つ (一回 grant。条件喪失でも失わない / 公式Q&A)
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  description:
    '【登場時】自分のリムーブエリアに〚カード名［宮野明美］〛がある場合、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // 〚リムーブエリアにあるカード名［諸星大］か［ライ］を1枚デッキの下に移す〛 (自分のみ / rules/21・Q&A)
  cost: {
    kind: 'removeAreaToDeckBottom',
    target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { cardName: ['諸星大', 'ライ'] } }, n: { min: 1, max: 1 }, chooser: 'owner' },
    n: 1,
  },
  // ターン終了時までこのキャラは〚ブレット〛を持つ
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: 'ブレット', scope: 'turn' } },
  description:
    '【宣言】【ターン1】〚リムーブエリアにあるカード名［諸星大］か［ライ］を1枚デッキの下に移す〛：ターン終了時までこのキャラは〚ブレット〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};

export const B08051: CardDef = {
  id: 'B08051',
  no: '0889/B08051',
  kind: 'character',
  names: ['赤井秀一'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['FBI', '赤井家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731238625553.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
