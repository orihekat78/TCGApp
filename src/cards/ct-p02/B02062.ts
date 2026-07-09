// cards/ct-p02/B02062 世良真純 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/10-action-event.md, rules/17-icons.md, rules/25-qa-effects-resolution.md, rules/14-refresh.md
// 公式テキスト:
//   【自分ターン中】【ターン1】相手の証拠がリムーブされたとき、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'evidence:removed',
    matcherCondition: {
      kind: 'triggerPlayerIs',
      side: 'opp'
    }
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      n: 1,
      player: 'self'
    }
  },
  description: '【自分ターン中】【ターン1】相手の証拠がリムーブされたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/17-icons.md',
    'rules/25-qa-effects-resolution.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B02062: CardDef = {
  id: 'B02062',
  no: '0225/B02062',
  kind: 'character',
  names: [
    '世良真純'
  ],
  colors: [
    '赤'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '赤井家'
  ],
  rarity: 'C',
  imageUrl: '1721357267310473.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/17-icons.md',
    'rules/25-qa-effects-resolution.md',
    'rules/14-refresh.md'
  ],
};
