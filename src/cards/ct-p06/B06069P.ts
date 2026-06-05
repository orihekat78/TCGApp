// cards/ct-p06/B06069P 鈴木園子 (キャラ パラレル) — engine-extension #4 batch
// B06069 と同一 (rarity 'CP' / imageUrl のみ差分)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '事件編' },
  cost: { kind: 'sleepSelf' },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【事件編】【宣言】【スリープ】：カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'atom',
    verb: 'sceneToHand',
    args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 7 } },
  },
  description: '【解決編】【宣言】【スリープ】：相手レベル7以下を1枚まで選び、手札に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B06069P: CardDef = {
  id: 'B06069P',
  no: '0690/B06069P',
  kind: 'character',
  names: ['鈴木園子'],
  colors: ['白'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['高校生', '鈴木財閥'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1755684967061000.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
