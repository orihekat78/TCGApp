// cards/ct-p03/B03099 大和敢助 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/17-icons.md, rules/15-abilities-effects.md, rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/03-field-areas.md
// 公式テキスト:
//   【ターン1】このキャラがアクションしたとき、自分のリムーブエリアにあるレベル6以下の〚特徴［長野県警］〛のキャラを1枚まで選び、スリープ状態で登場させる。
// 句マッピング:
//   - 【ターン1】このキャラがアクションしたとき、リムーブのLv6以下[長野県警]キャラ1枚までスリープ状態で登場 => action:declare(selfOnly)+limit{turn,1}→sceneEnter{from:remove,enterSleep:true,trait+levelMax6,max:1} [B02004 a1 (action:declare selfOnly + 【ターン1】 + from:remove) + D01012 enterSleep]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'action:declare',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: {
        trait: '長野県警',
        levelMax: 6,
        kind: 'character'
      }
    }
  },
  description: '【ターン1】このキャラがアクションしたとき、リムーブのレベル6以下の〚特徴［長野県警］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ]
};

export const B03099: CardDef = {
  id: 'B03099',
  no: '0352/B03099',
  kind: 'character',
  names: [
    '大和敢助'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '警察',
    '長野県警'
  ],
  rarity: 'C',
  imageUrl: '1729133463299752.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ],
};
