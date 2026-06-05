// cards/ct-p03/B03055 瀬戸瑞紀 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 11-reasoning.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】〚リムーブエリアに移す〛：レベル5以上のキャラを1枚まで選び、スリープさせる。
//
// a1: 宣言能力 — cost 【スリープ】(sleepSelf) + 〚リムーブエリアに移す〛(対象省略=自身 / removeFromScene self, rules/21)。
//     効果は sceneSetState sleep の短縮形 pick (levelMin5, side either)。
//     pay{items} で 2 コストを連結 (D08026 cost 連結とは別 / cost/pay payInner が順に処理)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】 + 〚リムーブエリアに移す〛 (対象省略 → このキャラ自身 / rules/21)
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeFromScene', target: { kind: 'self' }, n: 1 }] },
  // レベル5以上のキャラを1枚まで選び、スリープさせる
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep', filter: { levelMin: 5 } } },
  description: '【宣言】【スリープ】〚リムーブエリアに移す〛：レベル5以上のキャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B03055: CardDef = {
  id: 'B03055',
  no: '0310/B03055',
  kind: 'character',
  names: ['瀬戸瑞紀'],
  colors: ['白'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['怪盗', 'メイド'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133385834307.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
