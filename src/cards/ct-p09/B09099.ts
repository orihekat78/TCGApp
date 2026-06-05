// cards/ct-p09/B09099 バーボン (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【登場時】〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合、カードを1枚引き、手札を1枚リムーブする。
//     〚痕跡［未発見］〛の場合、相手のデッキのカードを上から1枚リムーブする。
//   【カットイン】【自分ターン中】AP＋2000
//
// a1: 【登場時】痕跡発見済 → draw1 + discard1 / 痕跡未発見 → 相手デッキ上 1 mill
// a2: 【カットイン】【自分ターン中】コンタクト中の攻撃キャラ AP＋2000

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 〚痕跡［発見済み］〛の場合 (engine 値は '発見済')
    if: { kind: 'scratchTrace', player: 'self', v: '発見済' },
    then: {
      kind: 'sequence',
      steps: [
        // カードを1枚引き
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        // 手札を1枚リムーブする
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      ],
    },
    // 〚痕跡［未発見］〛の場合、相手のデッキのカードを上から1枚リムーブする
    else: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 1 } },
  },
  description:
    '【登場時】痕跡発見済ならカードを1枚引き手札を1枚リムーブ、未発見なら相手デッキ上から1枚リムーブ。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  // AP＋2000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算 (D08007 同型)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】【自分ターン中】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B09099: CardDef = {
  id: 'B09099',
  no: '1038/B09099',
  kind: 'character',
  names: ['バーボン'],
  colors: ['黒'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608943919031.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
