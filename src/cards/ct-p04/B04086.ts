// cards/ct-p04/B04086 拳銃か！！ (イベント) — engine-extension event→evidence batch (2026-06-06 タスクC)
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

export const B04086: CardDef = {
  id: 'B04086',
  no: '0166/B04086',
  kind: 'event',
  names: ['拳銃か！！'],
  colors: ['黄'],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287841277882.jpg',
  abilities: [a1],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/15-abilities-effects.md'],
};
