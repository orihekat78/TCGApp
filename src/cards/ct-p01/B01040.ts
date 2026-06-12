// cards/ct-p01/B01040 「オレの和葉に何さらしとんじゃ!!!」 (イベント) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 20-color-and-switch.md
//
// 公式テキスト:
//   キャラを1枚まで選び、スリープさせる。カードを1枚引く。
//
// a1: effect:declared (event-use matcher) → sequence: sceneSetState(sleep, 1枚まで) → draw 1。
//     sceneSetState 短縮形 (D08019 a1 / D11009 a1 同型)、draw は D08013 a1 同型。

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
  effect: {
    kind: 'sequence',
    steps: [
      // キャラを1枚まで選び、スリープさせる
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
      // カードを1枚引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
  description: 'キャラを1枚まで選び、スリープさせる。カードを1枚引く。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md'],
};

// a2: 【ヒラメキ】キャラを1枚まで選びスリープ (BUG-140 補修 2026-06-13) — D05007 a2 同型
// (明示 $pick+target: hirameki fire は hiramekiResolve が chooseAtomTarget で auto-resolve するため短縮形不可)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B01040: CardDef = {
  id: 'B01040',
  no: '0034/B01040',
  kind: 'event',
  names: ['「オレの和葉に何さらしとんじゃ!!!」'],
  colors: ['緑'],
  level: 3,
  traits: [],
  rarity: 'C',
  imageUrl: '1714013020284784.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
  ],
};
