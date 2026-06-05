// cards/ct-p09/B09007P 脇田兼則 (キャラ パラレル) — engine-extension #1 leave:to-remove batch #2 (a2 only)
// B09007 と同型 (rarity RP / imageUrl のみ差分)
// a1: DEFERRED

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

export const B09007P: CardDef = {
  id: 'B09007P',
  no: '0952/B09007P',
  kind: 'character',
  names: ['脇田兼則'],
  colors: ['青'],
  level: 7, ap: 5000, lp: 1,
  traits: ['寿司職人'], keywords: [],
  rarity: 'RP',
  imageUrl: '1775608802632581.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
