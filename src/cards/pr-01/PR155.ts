// cards/pr-01/PR155 阿笠博士 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md, rules/19-special-rules.md, rules/17-icons.md
// 公式テキスト:
//   【登場時】手札からレベル6以下の〚カード名［灰原哀］〛のキャラを1枚までスリープ状態で登場させ、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［灰原哀］〛を1枚まで選び、手札に加える。
// 句マッピング:
//   - 【登場時】手札からLv6以下[灰原哀]キャラ1枚までスリープ状態で登場させ、カードを1枚引く => enter(selfOnly)→sequence[sceneEnter{from:hand,enterSleep:true,max:1}, draw1] (draw は「〜し、〜引く」で無条件、rules/15 必須効果) [B05112 from:hand + D01012 enterSleep + sequence pause-on-pick (resolver)]
//   - 【ヒラメキ】リムーブの[灰原哀]1枚まで手札 => evidence:remove-by-action(optional)→handAddFromRemove{cardName,max:1} [B02004 a2 verb]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          from: 'hand',
          max: 1,
          viaEffect: true,
          enterSleep: true,
          filter: {
            cardName: '灰原哀',
            levelMax: 6,
            kind: 'character'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'self',
          n: 1
        }
      }
    ]
  },
  description: '【登場時】手札からレベル6以下の〚カード名［灰原哀］〛のキャラを1枚までスリープ状態で登場させ、カードを1枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md',
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
        cardName: '灰原哀',
        kind: 'character'
      }
    }
  },
  description: '【ヒラメキ】リムーブの〚カード名［灰原哀］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/19-special-rules.md'
  ]
};

export const PR155: CardDef = {
  id: 'PR155',
  no: '0624/PR155',
  kind: 'character',
  names: [
    '阿笠博士'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '発明家'
  ],
  rarity: 'PR',
  imageUrl: '1753704129514734.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/19-special-rules.md',
    'rules/17-icons.md'
  ],
};
