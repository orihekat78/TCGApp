// cards/pr-01/PR192 キャンティ (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【カットイン】AP＋2000（コンタクト中に手札からリムーブして使う）
//
// a1: 【カットイン】AP＋2000 — D02012 同型 (effect:declared on-hand selfOnly, コンタクト中の攻撃キャラ
//     $contact.byUid を contact scope で +2000)。無条件キーワードは無し、能力はカットインのみ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  // 【カットイン】(コンタクト中に手札から使用)
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  // AP＋2000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const PR192: CardDef = {
  id: 'PR192',
  no: '0368/PR192',
  kind: 'character',
  names: ['キャンティ'],
  colors: ['黒'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1761913346592785.jpg',
  abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};
