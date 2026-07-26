// CT-P10 B10045 中森銀三
// rules: 05-turn-phases.md, 13-keywords.md, 15-abilities-effects.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1: AbilityDef = misreadX({ x: 1, abilityId: 'a1' });
const a2: AbilityDef = { id: 'a2', type: 'triggered', scope: 'on-scene', condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '中森青子' }, { kind: 'caseStatus', status: '解決編' }, { kind: 'turn', player: 'self' }] }, trigger: { hook: 'phase:end:start' }, effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } }, description: '【絆中森青子】【解決編】自分のターン終了時、このキャラをアクティブにする。', ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md'] };
export const B10045: CardDef = { id: 'B10045', no: '1105/B10045', kind: 'character', names: ['中森銀三'], colors: ['白'], level: 3, ap: 3000, lp: 0, traits: ['警察', '警視庁'], keywords: [], rarity: 'C', imageUrl: '1783904138037070.jpg', abilities: [a1, a2], ruleRefs: ['rules/05-turn-phases.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md'] };
