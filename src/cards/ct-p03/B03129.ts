// cards/ct-p03/B03129 ベルモット (キャラ) — engine-extension disguise-hook batch (2026-06-06 タスクC)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 23-qa-disguise-cutin.md
//
// 公式テキスト:
//   【変装】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）
//   【変装時】カードを1枚引く。
//
// a1: 変装 (icon-disguise)。ゲート条件【FILE6】を condition に格納 (canDisguise が評価)。
// a2: 【変装時】(disguise:into selfOnly = この (変装した) キャラが変装したとき)。カードを1枚引く
//     (D01006 a3 同型 draw)。rules/09: 変装は「登場」ではないため enter hook は発火せず disguise:into のみ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'icon-disguise',
  condition: { kind: 'fileAtLeast', n: 6 }, // 【FILE6】 (rules/09, rules/17 §条件アイコン)
  description: '【変装】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'disguise:into', selfOnly: true },
  // カードを1枚引く (D01006 a3 同型)
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【変装時】カードを1枚引く。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B03129: CardDef = {
  id: 'B03129',
  no: '0378/B03129',
  kind: 'character',
  names: ['ベルモット'],
  colors: ['黒'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133510413412.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/23-qa-disguise-cutin.md'],
};
