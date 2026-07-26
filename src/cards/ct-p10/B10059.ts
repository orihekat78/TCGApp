// CT-P10 B10059 宮野明美
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = { id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'caseStatus', status: '解決編' }, continuousModifier: { lvlDelta: 5 }, description: '【解決編】現場にいるこのキャラをレベル＋5する。', ruleRefs: ['rules/15-abilities-effects.md'] };
const a2: AbilityDef = { id: 'a2', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } }, description: '【カットイン】【自分ターン中】AP＋2000', ruleRefs: ['rules/09-cutin-disguise.md'] };
export const B10059: CardDef = { id: 'B10059', no: '1118/B10059', kind: 'character', names: ['宮野明美'], colors: ['赤'], level: 2, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '1783904159464068.jpg', abilities: [a1, a2], ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'] };
