// cards/ct-p07/B07095 ベルモット (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【登場時】キャラを1枚まで選び、スリープさせる。
//   【パートナー黒】【宣言】【スリープ】：レベル6以下のスリープ状態のキャラを1枚まで選び、リムーブする。
//
// a1: 【登場時】キャラを1枚まで選び、スリープさせる (enter hook + sceneSetState sleep、D08019 a2 同型 $pick+target)。
// a2: 【パートナー黒】【宣言】【スリープ】 cost (sleepSelf) で レベル6以下のスリープ状態のキャラを1枚まで選びリムーブ
//     (B04008 a1 sceneRemove + partnerColor condition 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // キャラを1枚まで選び、スリープさせる
  // 注: 明示 target ($pick + pick query) を保持 (短縮形だと auto-pick されないため D08019 a2 同型)。
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
    ],
  },
  description: '【登場時】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー黒】
  condition: { kind: 'partnerColor', color: '黒' },
  // 【スリープ】
  cost: { kind: 'sleepSelf' },
  // レベル6以下のスリープ状態のキャラを1枚まで選び、リムーブする。
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 6 }, state: ['sleep'] } },
  description: '【パートナー黒】【宣言】【スリープ】: レベル6以下のスリープ状態のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md', 'rules/17-icons.md'],
};

export const B07095: CardDef = {
  id: 'B07095',
  no: '0822/B07095',
  kind: 'character',
  names: ['ベルモット'],
  colors: ['黒'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1759154512429759.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
