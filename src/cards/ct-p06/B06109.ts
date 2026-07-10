// cards/ct-p06/B06109 紅の修学旅行 (case) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   この事件が解決編になったとき、相手はカードを1枚引く。\n自分は〚特徴［高校生］〛以外のキャラを手札から使用できない。（ネクストヒントでの使用も「手札から使用」に含まれる）

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always',
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true
  },
  effect: {
    args: {
      n: 1,
      player: 'opp'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: 'この事件が解決編になったとき、相手はカードを1枚引く。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'always',
  continuousModifier: {
    handUseRestrictFilter: {
      trait: '高校生'
    }
  },
  description: '自分は〚特徴［高校生］〛以外のキャラを手札から使用できない。（ネクストヒントでの使用も「手札から使用」に含まれる）',
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B06109: CardDef = {
  id: 'B06109',
  no: '0726/B06109',
  kind: 'case',
  names: [
    '紅の修学旅行'
  ],
  colors: [
    '青',
    '緑',
    '白',
    '赤',
    '黄'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'C',
  imageUrl: '1754285264422450.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
