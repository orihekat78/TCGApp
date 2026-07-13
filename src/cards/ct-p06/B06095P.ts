import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'always',
  trigger: { hook: 'case:to-resolved', selfOnly: true },
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always',
  condition: { kind: 'caseStatus', status: '解決編' },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
  limit: { kind: 'turn', n: 1 },
  effect: { kind: 'atom', verb: 'charGrantTraitAllAreasTurn', args: { player: 'self', trait: '喫茶ポアロ' } },
  description: 'ターン終了時まで、自分のすべてのエリアにあるキャラは〚特徴［喫茶ポアロ］〛を持つ。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B06095P: CardDef = {
  id: 'B06095P', no: '0714/B06095P', kind: 'case', names: ['榎本梓誘拐事件'], colors: ['黄'],
  caseTraits: [], traits: [], rarity: 'CP', imageUrl: '1755684985555041.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
