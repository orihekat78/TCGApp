// cards/ct-p04/B04009 灰原哀 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】〚リムーブエリアに移す〛：自分のリムーブエリアにある【青】のイベントを1枚まで選び、手札に加える。
//
// a1: 宣言能力 — cost 〚リムーブエリアに移す〛(対象省略=自身 / removeFromScene self, rules/21)。
//     effect handAddFromRemove 短縮形 pick (リムーブの【青】の event を1枚まで手札に; D11012 同型 + kind filter)。
//     kind:'event' は filter 対応フィールド (D11019 deckRevealUntil で kind:'character' 使用例あり)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 〚リムーブエリアに移す〛 (対象省略 → このキャラ自身 / rules/21)
  cost: { kind: 'removeFromScene', target: { kind: 'self' }, n: 1 },
  // 自分のリムーブエリアにある【青】のイベントを1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { color: '青', kind: 'event' } } },
  description: '【宣言】〚リムーブエリアに移す〛：リムーブの【青】イベントを1枚まで手札に加える。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};

export const B04009: CardDef = {
  id: 'B04009',
  no: '0414/B04009',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['少年探偵団', '科学者'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287656245086.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};
