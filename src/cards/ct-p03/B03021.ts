// cards/ct-p03/B03021 吉田歩美 (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【宣言】【スリープ】：カードを1枚引き、手札を1枚リムーブする。
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
//
// a1: declared cost=sleepSelf / effect= sequence[draw 1, discard 1] (D08013 a1 sequence + D08005 a2 declared 同型)。
// a2: 【カットイン】AP＋1000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算 (D11019 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】 (自身をスリープさせる)
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'sequence',
    steps: [
      // カードを1枚引き
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      // 手札を1枚リムーブする
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【宣言】【スリープ】：カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  // 【カットイン】AP＋1000
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B03021: CardDef = {
  id: 'B03021',
  no: '0279/B03021',
  kind: 'character',
  names: ['吉田歩美'],
  colors: ['青'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133201247514.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
