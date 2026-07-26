// cards/ct-d06/D06010 怪盗キッド (キャラ) — catalog-reuse batch
// rules: 05-turn-phases.md, 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【事件緑＆白】〚突撃〛（登場したターンからすぐにアクションできる）
//   【パートナー白】【ターン1】このキャラがアクションしたとき、カードを1枚引く。
//
// a1: continuous — 【事件緑＆白】(caseColor combine:'and') の間 〚突撃〛を持つ (条件外で即失効)。
// a2: triggered action:declare (selfOnly) — 【パートナー白】【ターン1】 アクション時に 1 ドロー。D11015 a1 同型 hook。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: 【事件緑＆白】の間 〚突撃〛 を付与 (continuous, grantKeywords)
const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【事件緑＆白】= 事件が緑と白の両方を持つ
  condition: { kind: 'caseColor', color: ['緑', '白'], combine: 'and' },
  // 〚突撃〛を持つ
  continuousModifier: { grantKeywords: () => ['突撃'], printedKeywordWhenIconValid: true },
  description: '【事件緑＆白】〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

// a2: 【パートナー白】【ターン1】このキャラがアクションしたとき、カードを1枚引く。
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー白】
  condition: { kind: 'partnerColor', color: '白' },
  // このキャラがアクションしたとき
  trigger: { hook: 'action:declare', selfOnly: true },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description:
    '【パートナー白】【ターン1】このキャラがアクションしたとき、カードを1枚引く。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/07-action-flow.md', 'rules/15-abilities-effects.md'],
};

export const D06010: CardDef = {
  id: 'D06010',
  no: '0169/D06010',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['怪盗'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1718844176820249.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
