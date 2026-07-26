// CT-P10 B10080 化け物屋敷の3人組
// rules: 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'either', filter: { trait: '警察', kind: 'character' } }, nMin: 1 },
  continuousModifier: { apDelta: -2000 },
  description: '自分か相手の現場に〚特徴［警察］〛のキャラがいる場合、このキャラをAP－2000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10080: CardDef = {
  id: 'B10080', no: '1136/B10080', kind: 'character', names: ['化け物屋敷の3人組'], colors: ['黄'],
  level: 3, ap: 5000, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '1783904202683849.jpg', abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
