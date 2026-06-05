// cards/ct-d09/D09022 高木渉 (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【登場時】カードを1枚引き、手札を1枚リムーブする。
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
//
// a1: 【登場時】sequence[draw 1, discard 1] (D08013 a1 同型)
// a2: 【カットイン】AP＋1000 (D08007 同型 inline atom / contact scope)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // カードを1枚引く
      { kind: 'atom', verb: 'draw',    args: { player: 'self', n: 1 } },
      // 手札を1枚リムーブする
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【登場時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  // 【カットイン】(コンタクト中に手札から使用)
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  // コンタクト中の攻撃キャラ ($contact.byUid) を AP＋1000 (コンタクト終了時に切れる)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const D09022: CardDef = {
  id: 'D09022',
  no: '0508/D09022',
  kind: 'character',
  names: ['高木渉'],
  colors: ['黄'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743742883061815.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
