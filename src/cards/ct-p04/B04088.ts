// cards/ct-p04/B04088 スコッチ (character) — engine mega-wave W5 exemplar (r37 removeDeckTop.n dyn, 2026-07-03)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー黒】【宣言】【スリープ】〚相手の現場にいるキャラ1枚につき、デッキのカードを上から
//     2枚リムーブする〛：AP8000以下のキャラを1枚まで選び、リムーブする。
//
// 句マッピング:
//   a1: 【パートナー黒】=> condition{kind:'partnerColor', color:'黒'} / 【宣言】=> type:'declared' /
//       【スリープ】=> cost item {kind:'sleepSelf'}。
//       〚相手の現場にいるキャラ1枚につき、デッキのカードを上から2枚リムーブする〛(「:」左=コスト) =>
//         cost item {kind:'removeDeckTop', player:'self', n:{dyn:'$self.oppSceneCount*2'}} (mega-wave W5
//         r37: n の {dyn} を canPay/pay が dispatch 時に解決。$self.oppSceneCount は B08086 で本番稼働済)。
//         player:'self' = 公式Q&A「コストでは自分のカードしか使えない (相手デッキはリムーブ不可)」。
//         公式Q&A「デッキが必要枚数ない場合、全部リムーブでの使用は不可」= canPay の deck.length >= n
//         厳格比較 (rules/21 一部でも行えなければ使用不可)。相手現場0体 → n=0 = コスト vacuous に成立。
//       「AP8000以下のキャラを1枚まで選び、リムーブする」=> sceneRemove{player:'self', max:1,
//         side:'either', filter:{apMax:8000, kind:'character'}} (D02002 系【宣言】idiom 完全同型。
//         「1枚まで」= 0枚可 / エリア無指定 = side:'either'、発動キャラ自身も選べる rules/15 /
//         AP は実効値で判定 = matchOneFilter)。
//   [hira/cutIn/henso col] 空 → 未カバー句なし。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '黒' },
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeDeckTop', player: 'self', n: { dyn: '$self.oppSceneCount*2' } },
    ],
  },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000, kind: 'character' } } },
  description: '【パートナー黒】【宣言】【スリープ】〚相手の現場にいるキャラ1枚につき、デッキのカードを上から2枚リムーブする〛：AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B04088: CardDef = {
  id: 'B04088',
  no: '0470/B04088',
  kind: 'character',
  names: ['スコッチ'],
  colors: ['黒'],
  level: 8,
  ap: 8000,
  lp: 2,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1735287841290490.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
