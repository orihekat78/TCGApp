// cards/ct-p04/B04096 真実を覆い隠す霧 (イベント) — catalog-reuse batch
// rules: 15-abilities-effects.md, 20-color-and-switch.md
//
// 公式テキスト:
//   カードを2枚引く。
//
// a1: イベント使用 (effect:declared selfOnly, matcher kind:'event-use'; D11020 同型) → 2ドロー。

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
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};
