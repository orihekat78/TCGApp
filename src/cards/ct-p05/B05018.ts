// cards/ct-p05/B05018 円谷光彦 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】〚リムーブエリアに移す〛：〚カード名［灰原哀］〛のキャラを1枚まで選び、ターン終了時までAP＋2000する。
//
// a1: 宣言能力 — cost 〚リムーブエリアに移す〛(removeFromScene self, rules/21)。
//     effect charModifyAP 短縮形 pick (cardName 灰原哀, max1, side either, ターン終了まで; D11015 a1 / B02010 filter 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 〚リムーブエリアに移す〛 (対象省略 → このキャラ自身 / rules/21)
  cost: { kind: 'removeFromScene', target: { kind: 'self' }, n: 1 },
  // 〚カード名［灰原哀］〛のキャラを1枚まで選び、ターン終了時までAP＋2000する
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, max: 1, side: 'either', scope: 'turn', filter: { cardName: '灰原哀' } } },
  description: '【宣言】〚リムーブエリアに移す〛：[灰原哀]を1枚まで選び、ターン終了時までAP＋2000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

export const B05018: CardDef = {
  id: 'B05018',
  no: '0524/B05018',
  kind: 'character',
  names: ['円谷光彦'],
  colors: ['青'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1743742488535020.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};
