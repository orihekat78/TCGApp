// cards/ct-p06/B06035 風神剣 (イベント) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   キャラを1枚まで選び、リムーブする。
//
// a1: effect:declared (event-use matcher) → キャラを1枚まで選びリムーブ (D11020 a1 step1 同型 / inline sceneRemove, filter なし)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  // キャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either' } },
  description: 'キャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

export const B06035: CardDef = {
  id: 'B06035',
  no: '0658/B06035',
  kind: 'event',
  names: ['風神剣'],
  colors: ['緑'],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1754285189462482.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};
