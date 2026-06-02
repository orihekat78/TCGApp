// cards/ct-d11/D11017 高木渉 (キャラ)
// rules: 09-cutin-disguise.md, 22-qa-action-contact.md, 23-qa-disguise-cutin.md
// spec: .claude/specs/cards-analysis/D11017.md
//
// 公式テキスト:
//   【カットイン】AP＋2000

import type { AbilityDef, CardDef } from '@/engine/types';

// 【カットイン】AP＋2000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const D11017: CardDef = {
  id: 'D11017',
  no: '0943/D11017',
  kind: 'character',
  names: ['高木渉'],
  colors: ['黄'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1775608977377076.jpg',
  abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};
