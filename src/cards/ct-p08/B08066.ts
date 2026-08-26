// cards/ct-p08/B08066 上原由衣 (キャラ) — engine拡張 wave#2 cluster4 (remove-area → deck-bottom, 2026-06-14)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】〚リムーブエリアにある特徴［長野県警］のキャラを1枚デッキの下に移す〛：
//     〚特徴［長野県警］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐに
//     アクションできる）を与える。
//
// 句マッピング:
//   a1: 【宣言】 => declared。
//       【スリープ】+〚リムーブエリアにある特徴［長野県警］のキャラを1枚デッキの下に移す〛 =>
//         cost pay[sleepSelf, removeAreaToDeckBottom{trait:'長野県警', kind:'character', side:'self', n:1}]
//         (B07079 a1 の pay[sleepSelf, sceneToDeckBottom] と同型。cluster4 新 cost。query.side:'self' =
//          rules/21「自分の」省略 + 公式Q&A「相手のカードは移せない」)。
//       「〚特徴［長野県警］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える」=>
//         charGrantKeyword 短縮形 {player:'self'(=chooser), max:1(=0〜1 skip可 rules/15), side:'either'
//         (「キャラ」に自分の限定なし → 両現場 / rules/15), filter:{trait:'長野県警', kind:'character'},
//         kw:'突撃', scope:'turn'} (B09032 a1 短縮形 carrier 同型。明示 uid:'$pick'+target は human 経路で
//         bind 喪失のため短縮形必須 / BUG-130)。
//
// 旧 DEFER は解消済み: removeAreaToDeckBottom cost は mutate.remove.removeFromHere を通じて
//   原因非依存の remove:exit を emit する。B05087/B05088 も同 hook の実consumerとして出荷済み。
//   Wave182 は本costから両observerが同時発動し、owner-order groupへ入るproduction経路を再認定した。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】〚リムーブエリアにある特徴［長野県警］のキャラを1枚デッキの下に移す〛 (自分のみ / rules/21・Q&A)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      {
        kind: 'removeAreaToDeckBottom',
        target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { trait: '長野県警', kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'owner' },
        n: 1,
      },
    ],
  },
  // 〚特徴［長野県警］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える (短縮形 carrier / either-side)
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { player: 'self', max: 1, side: 'either', filter: { trait: '長野県警', kind: 'character' }, kw: '突撃', scope: 'turn' } },
  description:
    '【宣言】【スリープ】〚リムーブエリアにある特徴［長野県警］のキャラを1枚デッキの下に移す〛：〚特徴［長野県警］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B08066: CardDef = {
  id: 'B08066',
  no: '0903/B08066',
  kind: 'character',
  names: ['上原由衣'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '長野県警'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731238722900.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
