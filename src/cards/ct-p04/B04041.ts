// cards/ct-p04/B04041 頂いて行くぜ！ (イベント) — engine-extension event→evidence batch (2026-06-06 タスクC)
// rules: 01-victory-conditions.md, 06-card-types.md, 15-abilities-effects.md
//
// 公式テキスト:
//   このカードを表向きのまま証拠として得る。
//
// a1: イベント使用 → 自身を表向きで証拠化 (selfToEvidence)。B04015 同型 (色違い)。

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

export const B04041: CardDef = {
  id: 'B04041',
  no: '0164/B04041',
  kind: 'event',
  names: ['頂いて行くぜ！'],
  colors: ['白'],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287759518033.jpg',
  abilities: [a1],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/15-abilities-effects.md'],
};
