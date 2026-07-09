// cards/ct-p06/B06028 風魔の小太郎 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【ヒラメキ】【事件YAIBA】【解決編】アクション中のキャラを1枚まで選び、リムーブする。（アクション［事件］による証拠の獲得までは進める）

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseTrait',
        trait: 'YAIBA'
      },
      {
        kind: 'caseStatus',
        status: '解決編'
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      uid: '$trigger.byUid',
      cause: 'effect'
    }
  },
  description: '【ヒラメキ】【事件YAIBA】【解決編】アクション中のキャラを1枚まで選び、リムーブする。（アクション［事件］による証拠の獲得までは進める）',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B06028: CardDef = {
  id: 'B06028',
  no: '0651/B06028',
  kind: 'character',
  names: [
    '風魔の小太郎'
  ],
  colors: [
    '緑'
  ],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: [
    'YAIBA'
  ],
  rarity: 'C',
  imageUrl: '1754285189422793.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
