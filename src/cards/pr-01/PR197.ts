// cards/pr-01/PR197 怪盗キッド (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【カットイン】AP＋2000
//
// a1: 【カットイン】AP＋2000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算 (D11019 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  // 【カットイン】(コンタクト中に手札から使用)
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  // AP＋2000
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const PR197: CardDef = {
  id: 'PR197',
  no: '0431/PR197',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['怪盗'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1764290716022546.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md',
  ],
};
