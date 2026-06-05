// cards/ct-p04/B04018P 遠山和葉 (パラレル) — B04018 と同型 (a2 only)

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【相手ターン中】【現場リムーブ時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04018P: CardDef = {
  id: 'B04018P',
  no: '0419/B04018P',
  kind: 'character',
  names: ['遠山和葉'],
  colors: ['緑'],
  level: 6, ap: 4000, lp: 1,
  traits: ['高校生'], keywords: [],
  rarity: 'RP',
  imageUrl: '1735287737381785.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
