// cards/ct-p03/B03134 ジンの眼光 (event) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   このイベントは、自分の証拠の数が相手の証拠の数以下の場合に使用できる。\n【パートナー黒】キャラを1枚まで選び、リムーブする。

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
    kind: 'and',
    cs: [
      {
        kind: 'evidenceDiff',
        player: 'opp',
        other: 'self',
        n: 0
      },
      {
        kind: 'partnerColor',
        color: '黒'
      }
    ]
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
  description: 'このイベントは、自分の証拠の数が相手の証拠の数以下の場合に使用できる。【パートナー黒】キャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B03134: CardDef = {
  id: 'B03134',
  no: '0383/B03134',
  kind: 'event',
  names: [
    'ジンの眼光'
  ],
  colors: [
    '黒'
  ],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133510452584.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
