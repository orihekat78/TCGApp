// cards/ct-d09/D09008 上原由衣 (キャラ) — catalog-reuse batch
// rules: 07-action-flow.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【FILE7】【自分ターン中】AP＋2000
//   このキャラがアクションしたとき、カードを1枚引く。
//
// a1: 常時有効 — 【FILE7】かつ【自分ターン中】の間 AP＋2000 (D08005 a1 同型 continuous)
// a2: triggered (action:declare) — このキャラがアクションしたとき draw (D08021 a3 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【FILE7】かつ【自分ターン中】
  condition: { kind: 'and', cs: [{ kind: 'fileAtLeast', n: 7 }, { kind: 'turn', player: 'self' }] },
  // AP＋2000
  continuousModifier: { apDelta: 2000 },
  description: '【FILE7】【自分ターン中】AP＋2000',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラがアクションしたとき
  trigger: { hook: 'action:declare', selfOnly: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'このキャラがアクションしたとき、カードを1枚引く。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md'],
};

export const D09008: CardDef = {
  id: 'D09008',
  no: '0502/D09008',
  kind: 'character',
  names: ['上原由衣'],
  colors: ['黄'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['警察', '長野県警'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743742875171492.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
