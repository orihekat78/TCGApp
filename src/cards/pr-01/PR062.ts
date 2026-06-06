// cards/pr-01/PR062 RUM!! (イベント) — event→evidence batch (黒)
// rules: 01-victory-conditions.md, 06-card-types.md, 15-abilities-effects.md
//
// 公式テキスト:
//   このカードを表向きのまま証拠として得る。
//
// a1: イベント使用 → 自身を表向きで証拠化 (selfToEvidence)。B04015 同型 (黒色)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: { kind: 'atom', verb: 'selfToEvidence', args: { faceUp: true } },
  description: 'このカードを表向きのまま証拠として得る。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/15-abilities-effects.md'],
};

export const PR062: CardDef = {
  id: 'PR062',
  no: '0406/PR062',
  kind: 'event',
  names: ['RUM!!'],
  colors: ['黒'],
  level: 7,
  traits: [],
  rarity: 'PR',
  imageUrl: '1732542002106556.jpg',
  abilities: [a1],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/15-abilities-effects.md'],
};
