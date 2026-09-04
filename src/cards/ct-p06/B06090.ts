// cards/ct-p06/B06090 榎本梓 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md
// 公式テキスト:
//   【登場時】このキャラをスリープさせてもよい。そうした場合、自分のリムーブエリアにあるレベル5以下の〚特徴［喫茶ポアロ］〛のキャラを1枚まで選び、登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［喫茶ポアロ］〛のキャラを1枚まで選び、手札に加える。

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
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'remove',
            max: 1,
            viaEffect: true,
            filter: {
              trait: '喫茶ポアロ',
              levelMax: 5,
              kind: 'character'
            }
          }
        }
        ]
      }
    }
  },
  description: '【登場時】このキャラをスリープさせてもよい。そうした場合、自分のリムーブエリアにあるレベル5以下の〚特徴［喫茶ポアロ］〛のキャラを1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
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
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        trait: '喫茶ポアロ',
        kind: 'character'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［喫茶ポアロ］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B06090: CardDef = {
  id: 'B06090',
  no: '0709/B06090',
  kind: 'character',
  names: [
    '榎本梓'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '喫茶ポアロ'
  ],
  rarity: 'C',
  imageUrl: '1754285264327460.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ],
};
