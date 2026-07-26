// CT-P10 B10016 レイ・カーティス
// rules: 07-action-flow.md, 11-reasoning.md, 13-keywords.md, 15-abilities-effects.md, 24-qa-naming-stun.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a2: AbilityDef = {
  id: 'a2', type: 'continuous', scope: 'on-scene',
  continuousModifier: { grantKeywords: () => ['text:sleepGuard'] },
  description: 'このキャラはスリープ状態でもガードできる。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/24-qa-naming-stun.md'],
};

export const B10016: CardDef = {
  id: 'B10016', no: '1078/B10016', kind: 'character', names: ['レイ・カーティス'], colors: ['青'], level: 3, ap: 3000, lp: 0,
  traits: ['サッカー選手'], keywords: [], rarity: 'C', imageUrl: '1783904094988584.jpg', abilities: [misreadX({ x: 1, abilityId: 'a1' }), a2],
  ruleRefs: ['rules/07-action-flow.md', 'rules/11-reasoning.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/24-qa-naming-stun.md'],
};
