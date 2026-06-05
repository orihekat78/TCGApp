// cards/ct-p01/B01063 ジョディ・スターリング (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】〚このキャラ以外のキャラを1枚スリープさせる〛：レベル7以下のキャラを1枚まで選び、リムーブする。
//
// a1: declared【宣言】 cost=このキャラ以外のキャラを1枚スリープ (sleepChar) /
//     effect= レベル7以下を1枚まで選びリムーブ (sceneRemove。D01003 cost + D11003 a2 effect 同型)。
// 注: 【スリープ】アイコンはコスト「このキャラ以外を1枚スリープ」の表記であり sleepSelf ではない。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 〚このキャラ以外のキャラを1枚スリープさせる〛 (cost の「自分の」省略 / rules/21 → side:'self' + excludeSelf)
  cost: {
    kind: 'sleepChar',
    target: { kind: 'pick', query: { area: 'scene', side: 'self', excludeSelf: true }, n: { min: 1, max: 1 }, chooser: 'self' },
  },
  // レベル7以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 7 } } },
  description: '【宣言】【スリープ】〚このキャラ以外のキャラを1枚スリープ〛: レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md', 'rules/17-icons.md'],
};

export const B01063: CardDef = {
  id: 'B01063',
  no: '0053/B01063',
  kind: 'character',
  names: ['ジョディ・スターリング'],
  colors: ['赤'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['FBI'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1714013041208834.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
