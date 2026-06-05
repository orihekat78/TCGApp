// cards/pr-01/PR202 キール (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【解決編】【登場時】手札を1枚リムーブする。カードを1枚引く。（自分の事件が解決編になっている場合、この能力か効果を使える）
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
//
// a1: 【解決編】【登場時】 enter trigger (caseStatus:解決編 で gate) → sequence: discard(1) + draw(1)。
//     D08013 a1 sequence 同型 / 条件付き enter は D08019 a1 同型 (caseStatus condition + enter hook)。
// a2: 【カットイン】 effect:declared (on-hand) でコンタクト中の攻撃キャラを AP＋1000。D08007 a1 同型 (固定値)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【解決編】
  condition: { kind: 'caseStatus', status: '解決編' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // 手札を1枚リムーブする
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      // カードを1枚引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【解決編】【登場時】手札を1枚リムーブする。カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  // 【カットイン】(コンタクト中に手札からリムーブして使う)
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  // コンタクト中の攻撃キャラを AP＋1000
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const PR202: CardDef = {
  id: 'PR202',
  no: '0836/PR202',
  kind: 'character',
  names: ['キール'],
  colors: ['黒'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1764290716046858.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
