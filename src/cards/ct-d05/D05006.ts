// cards/ct-d05/D05006 目暮十三 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/03-field-areas.md
// 公式テキスト:
//   【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル4以下の【黄】のキャラを1枚まで選び、スリープ状態で登場させる。
// 句マッピング:
//   - 【登場時】手札1リムーブしてもよい。そうした場合、リムーブのLv4以下【黄】キャラ1枚までスリープ状態で登場 => enter→optional{chain[discard1, sceneEnter{from:remove,enterSleep,color:黄,levelMax:4}]} [B05019 optional + D08003 chain + B02004 a1 from:remove + D01012 enterSleep]

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
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
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
            enterSleep: true,
            filter: {
              color: '黄',
              levelMax: 4,
              kind: 'character'
            }
          }
        }
      ]
    }
  },
  description: '【登場時】手札を1枚リムーブしてもよい。そうした場合、リムーブのレベル4以下の【黄】のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ]
};

export const D05006: CardDef = {
  id: 'D05006',
  no: '0151/D05006',
  kind: 'character',
  names: [
    '目暮十三'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'D',
  imageUrl: '1714013167788979.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ],
};
