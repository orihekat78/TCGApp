// cards/ct-p03/B03043 平次からのメール (イベント) — catalog-reuse batch
// rules: 15-abilities-effects.md, 20-color-and-switch.md
//
// 公式テキスト:
//   カードを2枚引く。
//
// a1: イベント使用時 (effect:declared / kind:'event-use') にカードを2枚引く。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      return (p as { kind?: unknown }).kind === 'event-use';
    },
  },
  // カードを2枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
  description: 'カードを2枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};

// a2: 【カットイン】【自分ターン中】AP＋1000 / 【相手ターン中】AP＋3000 (BUG-140 補修 2026-06-13) — B04096 a2 同型
// (コンタクト中はどちらか一方が必ず成立するため conditional if/else が意味等価 — rules/17 条件アイコン)
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

export const B03043: CardDef = {
  id: 'B03043',
  no: '0300/B03043',
  kind: 'event',
  names: ['平次からのメール'],
  colors: ['緑'],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133385731525.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};
