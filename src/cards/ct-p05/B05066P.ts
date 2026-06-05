// cards/ct-p05/B05066P 赤井秀一＆沖矢昴 (パラレル) — B05066 と同型

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

export const B05066P: CardDef = {
  id: 'B05066P',
  no: '0566/B05066P',
  kind: 'character',
  names: ['赤井秀一＆沖矢昴', '赤井秀一', '沖矢昴'],
  colors: ['赤'],
  level: 9, ap: 8000, lp: 2,
  traits: ['FBI', '赤井家', '大学院生'], keywords: [],
  rarity: 'MRP',
  imageUrl: '1747231524182594.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/19-special-rules.md'],
};
