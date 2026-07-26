// rules: 09-cutin-disguise.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { contactTargetMatches } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, contactTargetMatches({ traits: ['警察'] })] },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】【自分ターン中】特徴［警察］のキャラに【カットイン】する場合、AP＋2000。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B10078: CardDef = {
  id: 'B10078', no: '1134/B10078', kind: 'character', names: ['松田陣平'], colors: ['黄'], level: 2, ap: 1000, lp: 1,
  traits: ['警察', '警視庁'], keywords: [], rarity: 'C', imageUrl: '1783904202668787.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};
