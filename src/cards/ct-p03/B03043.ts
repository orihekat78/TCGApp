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
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};
