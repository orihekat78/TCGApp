// cards/ct-d08/D08023 毛利蘭 (キャラ)
// rules: 09-cutin-disguise.md, 17-icons.md, 22-qa-action-contact.md
// spec: .claude/specs/cards-analysis/D08023.md
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

export const D08023: CardDef = {
  id: 'D08023',
  no: '0096/D08023',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743100625132.jpg',
  abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};
