// cards/ct-p04/B04015 ……なるほどな… (イベント) — engine-extension event→evidence batch (2026-06-06 タスクC)
// rules: 01-victory-conditions.md, 06-card-types.md, 15-abilities-effects.md
//
// 公式テキスト:
//   このカードを表向きのまま証拠として得る。
//
// a1: イベント使用 (effect:declared selfOnly, matcher kind:'event-use') → 自身を表向きで証拠化
//     (selfToEvidence verb: handUseCard が remove へ置いた当該カードを remove→evidence へ移す)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use' },
  // このカードを表向きのまま証拠として得る
  effect: { kind: 'atom', verb: 'selfToEvidence', args: { faceUp: true } },
  description: 'このカードを表向きのまま証拠として得る。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/15-abilities-effects.md'],
};

export const B04015: CardDef = {
  id: 'B04015',
  no: '0162/B04015',
  kind: 'event',
  names: ['……なるほどな…'],
  colors: ['青'],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287656277670.jpg',
  abilities: [a1],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/15-abilities-effects.md'],
};
