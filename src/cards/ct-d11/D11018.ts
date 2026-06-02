// cards/ct-d11/D11018 佐藤美和子 (キャラ)
// rules: 09-cutin-disguise.md, 22-qa-action-contact.md, 23-qa-disguise-cutin.md
// spec: .claude/specs/cards-analysis/D11018.md
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

export const D11018: CardDef = {
  id: 'D11018',
  no: '0343/D11018',
  kind: 'character',
  names: ['佐藤美和子'],
  colors: ['黄'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1775608977385875.jpg',
  abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};
