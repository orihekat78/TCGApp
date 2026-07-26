// CT-P10 B10028 沖田総司
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'self' },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: { dyn: '$self.sceneTrait.高校生 * 1000' }, scope: 'contact' } },
  description: '【カットイン】【自分ターン中】自分の現場にいる【特徴［高校生］】のキャラ1枚につき、AP＋1000。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/22-qa-action-contact.md'],
};

export const B10028: CardDef = {
  id: 'B10028', no: '1089/B10028', kind: 'character', names: ['沖田総司'], colors: ['緑'], level: 2, ap: 1000, lp: 1,
  traits: ['高校生'], keywords: [], rarity: 'C', imageUrl: '1783904116867544.jpg', abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};
