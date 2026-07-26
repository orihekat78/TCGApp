// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 22-qa-action-contact.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B10055: CardDef = {
  id: 'B10055', no: '1114/B10055', kind: 'character', names: ['アンドレ・キャメル'], colors: ['赤'], level: 6, ap: 7000, lp: 0,
  traits: ['FBI'], keywords: [], rarity: 'C', imageUrl: '1783904159433750.jpg', abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/22-qa-action-contact.md'],
};
