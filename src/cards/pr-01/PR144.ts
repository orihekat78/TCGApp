// cards/pr-01/PR144 ラム (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md, rules/03-field-areas.md
// 公式テキスト:
//   【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下の〚特徴［黒ずくめの組織］〛のキャラを1枚まで選び、登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【登場時】このキャラをスリープさせ手札1リムーブしてもよい。そうした場合、リムーブのLv6以下[黒ずくめの組織]キャラ1枚まで登場 => enter→optional{chain[sceneSetState$self sleep, discard1, sceneEnter{from:remove,trait:黒ずくめの組織,levelMax:6}]} [B05019 optional + D08003 chain + B01011 self-sleep + B02004 a1 from:remove]
//   - 【ヒラメキ】キャラを1枚まで選びスリープ => evidence:remove-by-action(optional)→sceneSetState pick [D03013 a2]

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
    kind: 'conditional',
    if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
    then: {
      kind: 'optional',
      effect: {
        kind: 'chain',
        steps: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$self',
            state: 'sleep'
          }
        },
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        },
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'remove',
            max: 1,
            viaEffect: true,
            filter: {
              trait: '黒ずくめの組織',
              levelMax: 6,
              kind: 'character'
            }
          }
        }
        ]
      }
    }
  },
  description: '【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、リムーブのレベル6以下の〚特徴［黒ずくめの組織］〛のキャラを1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
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
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'either'
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/03-field-areas.md'
  ]
};

export const PR144: CardDef = {
  id: 'PR144',
  no: '0623/PR144',
  kind: 'character',
  names: [
    'ラム'
  ],
  colors: [
    '黒'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'PR',
  imageUrl: '1747874045615220.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/03-field-areas.md'
  ],
};
