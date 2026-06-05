// cards/ct-p09/B09101 犯人 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【事件犯人】【宣言】【ターン1】【スリープ】：レベル7以下のキャラを1枚まで選び、リムーブする。
//
// a1: 【事件犯人】(caseTrait '犯人') gate + 【宣言】【ターン1】【スリープ】cost sleepSelf
//     → レベル7以下のキャラを1枚まで選びリムーブ (D11003 a2 同型 + caseTrait condition)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【事件犯人】= 自分の事件が特徴[犯人]を持つ
  condition: { kind: 'caseTrait', trait: '犯人' },
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  cost: { kind: 'sleepSelf' }, // 【スリープ】
  // レベル7以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 7 } } },
  description: '【事件犯人】【宣言】【ターン1】【スリープ】：レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B09101: CardDef = {
  id: 'B09101',
  no: '1040/B09101',
  kind: 'character',
  names: ['犯人'],
  colors: ['黒'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['犯人'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608943936441.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
