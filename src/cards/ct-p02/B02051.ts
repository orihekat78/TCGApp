// cards/ct-p02/B02051 レッドヘリング (イベント) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   自分の現場にいるキャラを1枚スリープさせてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
//
// a1: effect:declared (event-use matcher) → chain。
//     step1: 自分の現場のキャラを1枚スリープ (してもよい)。step2: step1 適用時のみ レベル7以下を1枚までリムーブ。
//     chain semantics (D08003 a1 同型): step1 が no-candidate / skip なら step2 を実行しない。

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
    kind: 'chain',
    steps: [
      // 自分の現場にいるキャラを1枚スリープさせてもよい
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'self', state: 'sleep' } },
      // そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする (step1 適用時のみ)
      { kind: 'atom', verb: 'sceneRemove',   args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } },
    ],
  },
  description:
    '自分の現場のキャラを1枚スリープさせてもよい。そうした場合、レベル7以下のキャラを1枚までリムーブする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

export const B02051: CardDef = {
  id: 'B02051',
  no: '0172/B02051',
  kind: 'event',
  names: ['レッドヘリング'],
  colors: ['白'],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1721357250048492.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};
