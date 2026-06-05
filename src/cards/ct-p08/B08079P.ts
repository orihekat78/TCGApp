// cards/ct-p08/B08079P ピンガ (パラレル) — B08079 と同型 (a3 DEFER)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDelta: 1000 },
  description: '【自分ターン中】AP＋1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw',    args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【相手ターン中】【現場リムーブ時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B08079P: CardDef = {
  id: 'B08079P',
  no: '0915/B08079P',
  kind: 'character',
  names: ['ピンガ'],
  colors: ['黒'],
  level: 8, ap: 7000, lp: 1,
  traits: ['黒ずくめの組織'], keywords: [],
  rarity: 'SRP',
  imageUrl: '1770878999157246.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
