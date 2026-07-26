// rules: 09-cutin-disguise.md, 10-action-event.md, 15-abilities-effects.md, 22-qa-action-contact.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { contactTargetMatches } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
    { kind: 'conditional', if: contactTargetMatches({ names: ['伊達航', '高木渉'] }), then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
  ] },
  description: '【カットイン】AP＋1000。カード名［伊達航］か［高木渉］に【カットイン】した場合、カードを1枚引く。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: ['伊達航', '高木渉'] } } },
  description: '【ヒラメキ】自分のリムーブエリアにあるカード名［伊達航］か［高木渉］を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B10076: CardDef = {
  id: 'B10076', no: '1132/B10076', kind: 'character', names: ['ナタリー・来間'], colors: ['黄'], level: 2, ap: 1000, lp: 0,
  traits: ['英語講師'], keywords: [], rarity: 'C', imageUrl: '1783904202654262.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/22-qa-action-contact.md'],
};
