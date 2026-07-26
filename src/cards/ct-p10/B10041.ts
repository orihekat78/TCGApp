// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 22-qa-action-contact.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B10041: CardDef = {
  id: 'B10041', no: '1101/B10041', kind: 'character', names: ['工藤優作'], colors: ['白'], level: 2, ap: 1000, lp: 1,
  traits: ['小説家'], keywords: [], rarity: 'C', imageUrl: '1783904138009997.jpg', abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/22-qa-action-contact.md'],
};
