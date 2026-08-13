// cards/ct-p05/B05066P 赤井秀一＆沖矢昴 (パラレル) — B05066 と同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    matcherCondition: {
      kind: 'removedCharMatches',
      side: 'opp',
    },
  },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '赤' },
      { kind: 'turn', player: 'self' },
    ],
  },
  limit: {
    kind: 'turn',
    n: 1,
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      cause: 'effect',
      filter: {
        kind: 'character',
        levelMax: 8,
      },
    },
  },
  description: '相手の現場にいるキャラがリムーブされたとき、自分のターン中、レベル8以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area', // M3 PA batch (2026-07-10): 「この能力はパートナーエリアでも宣言できる」(rules/18)
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'atom',
    verb: 'charModifyLevel',
    args: { player: 'self', max: 1, side: 'opp', delta: -1, scope: 'turn' },
  },
  description: '【宣言】【ターン1】相手の現場のキャラを1枚までレベル-1 (ターン終了時まで)。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

// a3: 【カットイン】AP＋2000 (BUG-140 補修 2026-06-13: TSV cutIn 列の取りこぼし修正) — D08015 a2 同型
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
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
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/19-special-rules.md'],
};
