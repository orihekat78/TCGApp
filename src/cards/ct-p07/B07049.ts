// cards/ct-p07/B07049 フィリップ王子 (character) — engine A1 wave exemplar (handAddFromRemove area union, 2026-07-11)
// rules: 03-field-areas.md (§パートナーエリア), 15-abilities-effects.md (§「まで」=0可),
//        17-icons.md, 21-declared-ability-cost.md (§コスト「デッキの下に移す」)
//
// 公式テキスト:
//   【宣言】〚デッキの下に移す〛：自分のリムーブエリアかパートナーエリアにある〚特徴［ビッグジュエル］〛の
//   カードを1枚まで選び、手札に加える。
//
// 句マッピング:
//   - 【宣言】 => type:'declared'
//   - 〚デッキの下に移す〛(コスト) => cost:{ kind:'selfToDeckBottom' } (D07008/B09044 同型、スリープ無し)
//   - 「自分のリムーブエリアかパートナーエリアにある〚特徴[ビッグジュエル]〛のカードを1枚まで選び、手札に加える」
//     => handAddFromRemove の area union (remove ∪ partner-area) cardIds 契約 (engine A1 wave 新分岐):
//        query.area:['remove','partner-area'] + filter{trait:'ビッグジュエル'} (kind 無指定 = カード全種)。
//        candidates は partnerAreaCards + remove を列挙、splice は core.ts が area 順に消費。
//        n:{min:0,max:1} = 「1枚まで」(rules/15 0枚可)。chooser:'self' = 「自分が選ぶ」。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'selfToDeckBottom' }, // 〚デッキの下に移す〛
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      cardIds: '$pick.cardIds',
      target: {
        kind: 'pick',
        query: { area: ['remove', 'partner-area'], side: 'self', filter: { trait: 'ビッグジュエル' } },
        n: { min: 0, max: 1 }, // 「1枚まで」= 0可 (rules/15)
        chooser: 'self',
      },
    },
  },
  description:
    '【宣言】〚デッキの下に移す〛：自分のリムーブエリアかパートナーエリアにある〚特徴[ビッグジュエル]〛のカードを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B07049: CardDef = {
  id: 'B07049',
  no: '0778/B07049',
  kind: 'character',
  names: ['フィリップ王子'],
  colors: ['白'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['王子'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414010570757.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
