// cards/ct-p06/B06007P 灰原哀 (パラレル) — B06007 と同型

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '../_shared/index.js';

const a1 = misreadX({ x: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '青' },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
      { kind: 'atom', verb: 'sceneToHand', args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 7 } } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    ],
  },
  description: '【パートナー青】【登場時】3択: 突撃付与 / 相手 lv≤7 bounce / 2 ドロー。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B06007P: CardDef = {
  id: 'B06007P',
  no: '0632/B06007P',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 7, ap: 5000, lp: 1,
  traits: ['少年探偵団', '科学者'], keywords: [],
  rarity: 'RP',
  imageUrl: '1755684931835023.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/11-reasoning.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
