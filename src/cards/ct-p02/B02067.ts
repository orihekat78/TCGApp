// rules: 15-abilities-effects.md, 16-card-set.md, 25-qa-effects-resolution.md
import type { AbilityDef, CardDef } from '@/engine/types';

// Keep the shipped choose-intercept ability id (`a1`) stable for saved turn-use
// history. The previously omitted event-use/set line is restored as `a0`.
const a0: AbilityDef = {
  id: 'a0',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (payload: unknown) => (payload as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'self', fromSelf: true, n: 1, filter: { kind: 'character', color: '赤' } },
  },
  description: 'このイベントを自分の現場にいる【赤】のキャラ1枚にセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-set-host', limit: { kind: 'turn', n: 1 },
  trigger: { hook: 'effect:choose-intercept' as never },
  description: '【ターン1】このキャラが相手の能力や効果によって選ばれたとき、それを無効にする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/25-qa-effects-resolution.md'],
};

export const B02067: CardDef = {
  id: 'B02067', no: '0230/B02067', kind: 'event', names: ['チョーカー型変声機'], colors: ['赤'], level: 4,
  rarity: 'C', imageUrl: '1721357267333530.jpg', traits: [], keywords: [], abilities: [a0, a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/25-qa-effects-resolution.md'],
};
