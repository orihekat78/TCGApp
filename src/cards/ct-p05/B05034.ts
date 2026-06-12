// cards/ct-p05/B05034 国末照明 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/10-action-event.md, rules/14-refresh.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある【緑】のイベントを1枚まで選び、手札に加える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【緑】のイベントを1枚まで選び、手札に加える。
// 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】リムーブの【緑】イベント1枚まで手札 => turn:opp + leave:to-remove(selfOnly)→handAddFromRemove{color:緑,kind:event,max:1} [B02004 a2 同型]
//   - 【ヒラメキ】リムーブの【緑】イベント1枚まで手札 => evidence:remove-by-action(optional)→handAddFromRemove 同上 [B01011 a2 hook + B02004 a2 verb]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'opp'
  },
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        color: '緑',
        kind: 'event'
      }
    }
  },
  description: '【相手ターン中】【現場リムーブ時】リムーブの【緑】のイベントを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
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
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        color: '緑',
        kind: 'event'
      }
    }
  },
  description: '【ヒラメキ】リムーブの【緑】のイベントを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B05034: CardDef = {
  id: 'B05034',
  no: '0538/B05034',
  kind: 'character',
  names: [
    '国末照明'
  ],
  colors: [
    '緑'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    '大学生'
  ],
  rarity: 'C',
  imageUrl: '1745322178460794.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ],
};
