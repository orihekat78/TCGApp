// cards/ct-p04/B04096 真実を覆い隠す霧 (イベント) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   カードを2枚引く。
//   【カットイン】【自分ターン中】AP＋1000
//   【相手ターン中】AP＋3000
//
// a1: イベント使用 (effect:declared selfOnly, matcher kind:'event-use'; D11020 同型) → 2ドロー。
// a2: 【カットイン】 (BUG-140 補修 2026-06-13): catalog-reuse batch が TSV cutIn 列を取りこぼして
//     いた欠落の修正 (wave#2 cluster2 の MCP decoy 検証で発見)。D08015 a2 正準形 + ターン側で
//     delta を分岐 (【自分ターン中】+1000 / 【相手ターン中】+3000 — rules/17 条件アイコン、
//     コンタクト中はどちらか一方が必ず成立するため conditional if/else が意味等価)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use' },
  // カードを2枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
  description: 'カードを2枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md'],
};

// a2: 【カットイン】【自分ターン中】AP＋1000 / 【相手ターン中】AP＋3000
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: {
    kind: 'conditional',
    if: { kind: 'turn', player: 'self' },
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
    else: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 3000, scope: 'contact' } },
  },
  description: '【カットイン】【自分ターン中】AP＋1000\n【相手ターン中】AP＋3000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};

export const B04096: CardDef = {
  id: 'B04096',
  no: '0478/B04096',
  kind: 'event',
  names: ['真実を覆い隠す霧'],
  colors: ['黒'],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287857884506.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};
