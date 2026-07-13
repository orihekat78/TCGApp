import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '白' },
      { kind: 'caseStatus', status: '解決編' },
    ],
  },
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (payload: unknown) => (payload as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      player: 'self',
      side: 'either',
      state: 'stun',
      max: 2,
      aggregateLevelMax: 10,
    },
  },
  description: '【パートナー白】【解決編】レベルの合計が10以下になるようにキャラを2枚まで選び、スタンさせる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

export const B04042: CardDef = {
  id: 'B04042',
  no: '0437/B04042',
  kind: 'event',
  names: ['「よォ名探偵…」'],
  colors: ['白'],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287759523295.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};
