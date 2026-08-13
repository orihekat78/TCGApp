// CT-P10 B10082 出会っていた5人組
// rules: 01-victory-conditions.md, 14-refresh.md, 15-abilities-effects.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '@/cards/_shared';

const a1 = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });
const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always',
  condition: { kind: 'and', cs: [{ kind: 'caseStatus', status: '解決編' }, { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '降谷零', kind: 'character' } }, nMin: 1 }] },
  limit: { kind: 'turn', n: 1 }, cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', chooseMatch: 'upTo', maxN: 2, filter: { kind: 'character', cardName: ['降谷零', '諸伏景光', '伊達航', '萩原研二', '松田陣平'] }, bind: '$revealed', bindMatch: '$matched' } },
    { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', deferRefresh: true } } },
    { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed', refreshAfter: true } },
  ] },
  description: '裏向きの証拠2つを表向きにし、上から2枚の指定キャラを手札に加え、残りをリムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
export const B10082: CardDef = {
  id: 'B10082', no: '1138/B10082', kind: 'case', names: ['出会っていた5人組'], colors: ['黄'], caseLevel: 7, caseTraits: [], traits: [], rarity: 'R', imageUrl: '1783904202704352.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
export const B10082P: CardDef = { ...B10082, id: 'B10082P', no: '1138/B10082P', rarity: 'RP', imageUrl: '1783904202711117.jpg' };
