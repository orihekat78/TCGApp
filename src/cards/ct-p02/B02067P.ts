// rules: 15-abilities-effects.md, 16-card-set.md, 25-qa-effects-resolution.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-set-host', limit: { kind: 'turn', n: 1 },
  trigger: { hook: 'effect:choose-intercept' as never },
  description: '【ターン1】このキャラが相手の能力や効果によって選ばれたとき、それを無効にする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/25-qa-effects-resolution.md'],
};

export const B02067P: CardDef = {
  id: 'B02067P', no: '0230/B02067P', kind: 'event', names: ['チョーカー型変声機'], colors: ['赤'], level: 4,
  rarity: 'CP', imageUrl: '1721357267336451.jpg', traits: [], keywords: [], abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/25-qa-effects-resolution.md'],
};
