// cards/ct-p05/B05081 威嚇射撃 (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/03-field-areas.md
// 公式テキスト:
//   このイベントは自分の現場にいるキャラが相手の現場にいるキャラより少ない場合に使用できる。\nキャラを1枚まで選び、リムーブする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  condition: {
    kind: 'sceneCountCompare',
    player: 'self',
    other: 'opp',
    cmp: 'lt'
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      cause: 'effect'
    }
  },
  description: 'このイベントは自分の現場にいるキャラが相手の現場にいるキャラより少ない場合に使用できる。キャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ]
};

export const B05081: CardDef = {
  id: 'B05081',
  no: '0581/B05081',
  kind: 'event',
  names: [
    '威嚇射撃'
  ],
  colors: [
    '赤'
  ],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1746628078723000.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ],
};
