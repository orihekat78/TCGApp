// cards/ct-p07/B07101 テキーラ (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】〚リムーブエリアに移す〛：レベル5以上のキャラを1枚まで選び、スリープさせる。
//
// a1: 宣言能力 — cost 【スリープ】(sleepSelf) + 〚リムーブエリアに移す〛(対象省略=自身 / removeFromScene self, rules/21)。
//     B03055/B07007 と同型 (pay{items} で 2 コスト連結)。効果は sceneSetState sleep 短縮形 pick (levelMin5, side either)。

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

export const B07101: CardDef = {
  id: 'B07101',
  no: '0828/B07101',
  kind: 'character',
  names: ['テキーラ'],
  colors: ['黒'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414041036261.jpg',
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
