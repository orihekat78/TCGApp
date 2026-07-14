// cards/ct-p05/B05033 楠川探偵
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  continuousModifier: { alternativeCostProvider: { targetFilter: { kind: 'character', trait: '探偵' } } },
  description: '自分の現場にいる〚特徴［探偵］〛のキャラは、コスト（【スリープ】を含む）を支払う代わりにこのキャラを現場からリムーブすることで【宣言】能力を宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B05033: CardDef = {
  id: 'B05033', no: '0537/B05033', kind: 'character', names: ['楠川探偵'], colors: ['緑'], level: 4, ap: 4000, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '1745322178456975.jpg', abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
