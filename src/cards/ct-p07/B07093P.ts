// cards/ct-p07/B07093P バーボン＆ライ (パラレル) — B07093 と同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'atom',
    verb: 'charModifyLevel',
    args: { player: 'self', max: 1, side: 'opp', delta: -1, scope: 'turn' },
  },
  description: '【宣言】【ターン1】相手の現場のキャラを1枚までレベル-1 (ターン終了時まで)。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B07093P: CardDef = {
  id: 'B07093P',
  no: '0820/B07093P',
  kind: 'character',
  names: ['バーボン＆ライ', 'バーボン', 'ライ'],
  colors: ['黒'],
  level: 9, ap: 8000, lp: 2,
  traits: ['黒ずくめの組織'], keywords: [],
  rarity: 'MRP',
  imageUrl: '1763546840464776.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/19-special-rules.md'],
};
