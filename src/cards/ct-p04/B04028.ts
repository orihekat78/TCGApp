// cards/ct-p04/B04028 そーいう事かいな… (イベント) — engine-extension event→evidence batch (2026-06-06 タスクC)
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

// a2: 【ヒラメキ】自分は証拠を1つ得る (BUG-140 補修 2026-06-13) — D03011 a2 trigger + evidenceGain (D11003 a1 同 verb)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // 自分は証拠を1つ得る
  effect: { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分は証拠を1つ得る。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B04028: CardDef = {
  id: 'B04028',
  no: '0163/B04028',
  kind: 'event',
  names: ['そーいう事かいな…'],
  colors: ['緑'],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287737436527.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/15-abilities-effects.md'],
};
