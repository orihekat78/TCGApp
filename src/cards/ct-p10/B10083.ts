// CT-P10 B10083 帰らざる刑事
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '@/cards/_shared';

const a1 = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });
const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always',
  condition: { kind: 'and', cs: [{ kind: 'caseStatus', status: '解決編' }, { kind: 'fileAtLeast', n: 5 }] },
  limit: { kind: 'turn', n: 1 }, cost: { kind: 'flipFaceUpEvidence', n: { min: 3, max: 3 } },
  effect: { kind: 'atom', verb: 'sceneToEvidence', args: { player: 'self', max: 1, filter: { cardName: '松田陣平', kind: 'character' }, faceUp: true } },
  description: '自分の現場の松田陣平を1枚まで、表向きのまま証拠として得る。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
export const B10083: CardDef = {
  id: 'B10083', no: '1139/B10083', kind: 'case', names: ['帰らざる刑事'], colors: ['黄'], caseLevel: 7, caseTraits: [], traits: [], rarity: 'C', imageUrl: '1783904202718270.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
export const B10083P: CardDef = { ...B10083, id: 'B10083P', no: '1139/B10083P', rarity: 'CP', imageUrl: '1783904202726991.jpg' };
