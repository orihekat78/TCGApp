// cards/ct-p09/B09083 千葉和伸 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】〚リムーブエリアに移す〛：自分の現場にいる〚カード名［佐藤美和子］〛か〚［高木渉］〛を1枚まで選び、ターン終了時までAP＋2000する。
//
// a1: 宣言能力 — コスト〚リムーブエリアに移す〛(対象省略 = このキャラ自身 rules/21) で
//     removeFromScene{ target:self, n:1 }。効果は charModifyAP 短縮形 pick
//     (cardName 佐藤美和子/高木渉 OR, side:self, AP+2000 turn) — D11012 a1 charModifyAP 短縮形同型。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 〚リムーブエリアに移す〛: 対象省略 → このキャラ自身を現場からリムーブエリアへ (rules/21 対象省略解釈)
  cost: { kind: 'removeFromScene', target: { kind: 'self' }, n: 1 },
  // 自分の現場にいる〚カード名［佐藤美和子］〛か〚［高木渉］〛を1枚まで選び、ターン終了時までAP＋2000する。
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, max: 1, side: 'self', filter: { cardName: ['佐藤美和子', '高木渉'] }, scope: 'turn' } },
  description: '【宣言】〚リムーブエリアに移す〛: 自分の現場の[佐藤美和子]か[高木渉]を1枚まで選び、ターン終了時までAP＋2000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

export const B09083: CardDef = {
  id: 'B09083',
  no: '1023/B09083',
  kind: 'character',
  names: ['千葉和伸'],
  colors: ['黄'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608910358507.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
