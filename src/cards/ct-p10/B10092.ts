// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 22-qa-action-contact.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B10092: CardDef = {
  id: 'B10092', no: '1147/B10092', kind: 'character', names: ['キール'], colors: ['黒'], level: 2, ap: 1000, lp: 1,
  traits: ['黒ずくめの組織'], keywords: [], rarity: 'C', imageUrl: '1783904232359811.jpg', abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/22-qa-action-contact.md'],
};
