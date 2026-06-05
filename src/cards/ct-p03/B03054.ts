// cards/ct-p03/B03054 鈴木園子 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   自分の現場にレベル6以上の〚カード名［江戸川コナン］〛がいる場合、このキャラをLP＋1する。
//   【絆京極真】【宣言】【ターン1】〚手札を1枚リムーブする〛：スリープ状態のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//
// a1: continuous (常時有効型) — 自分の現場にレベル6以上の[江戸川コナン]がいる間、このキャラを LP＋1 (self continuousModifier。D08005 a1 同型)。
// a2: declared【絆京極真】【ターン1】 cost=手札1枚リム / effect= スリープ状態のキャラを1枚まで選び、スタンさせる
//     ($pick + target pick query (state:['sleep']) で D02013 / D08019 a2 同型。スタン挙動 rules/03/24 は sceneSetState:'stun' で担保)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 自分の現場にレベル6以上の[江戸川コナン]がいる場合
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '江戸川コナン', levelMin: 6 } }, nMin: 1 },
  // このキャラをLP＋1する。
  continuousModifier: { lpDelta: 1 },
  description: '自分の現場にレベル6以上の[江戸川コナン]がいる場合、このキャラをLP＋1する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【絆京極真】
  condition: { kind: 'bond', cardName: '京極真' },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 〚手札を1枚リムーブする〛
  cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  // スリープ状態のキャラを1枚まで選び、スタンさせる。
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          uid: '$pick',
          state: 'stun',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'either', state: ['sleep'] },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description: '【絆京極真】【宣言】【ターン1】〚手札を1枚リムーブする〛：スリープ状態のキャラを1枚まで選び、スタンさせる。',
  ruleRefs: ['rules/13-keywords.md', 'rules/21-declared-ability-cost.md', 'rules/03-field-areas.md', 'rules/24-qa-naming-stun.md'],
};

export const B03054: CardDef = {
  id: 'B03054',
  no: '0309/B03054',
  kind: 'character',
  names: ['鈴木園子'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['高校生', '鈴木財閥'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133385822087.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};
