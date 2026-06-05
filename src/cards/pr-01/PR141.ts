// cards/pr-01/PR141 灰原哀 (PR variant) — bounce batch #2 (a1 only)
// PR135 と同型 (imageUrl のみ差分、parallel)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: {
    kind: 'sceneHas',
    query: { area: 'scene', side: 'self', filter: { cardName: '阿笠博士', levelMin: 6 } },
    nMin: 1,
  },
  effect: {
    kind: 'atom',
    verb: 'sceneToHand',
    args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 8 } },
  },
  description: '【登場時】自陣 lv6+ 阿笠博士で 相手 level≤8 を 1枚 bounce。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const PR141: CardDef = {
  id: 'PR141',
  no: '0620/PR141',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 5, ap: 5000, lp: 1,
  traits: ['少年探偵団', '科学者'], keywords: [],
  rarity: 'PR',
  imageUrl: '1747874027875756.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
