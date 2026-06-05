// cards/ct-p03/B03011 ゴロ (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】〚デッキの下に移す〛：LP0の【青】のキャラを1枚まで選び、ターン終了時までLP＋1する。
//
// a1: 【宣言】〚デッキの下に移す〛コスト (selfToDeckBottom) → LP0の【青】を1枚まで選び LP+1 (turn)
//     D11012 a1 同型 (charModifyLP 短縮形 max/side/filter/scope)。
//     LP0 = 有効LP がちょうど0 (rules/19: LP は ±修正で負にもなりうるため lpMin:0+lpMax:0 で厳密一致)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 〚デッキの下に移す〛: コストとして自身をデッキの下に移す (rules/21)
  cost: { kind: 'selfToDeckBottom' },
  // LP0の【青】のキャラを1枚まで選び、ターン終了時までLP＋1する
  effect: { kind: 'atom', verb: 'charModifyLP', args: { delta: 1, max: 1, side: 'either', filter: { color: '青', lpMin: 0, lpMax: 0 }, scope: 'turn' } },
  description: '【宣言】〚デッキの下に移す〛：LP0の【青】のキャラを1枚まで選び、ターン終了時までLP＋1する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B03011: CardDef = {
  id: 'B03011',
  no: '0269/B03011',
  kind: 'character',
  names: ['ゴロ'],
  colors: ['青'],
  level: 3,
  ap: 3000,
  lp: 0,
  traits: ['猫'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133048298268.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
