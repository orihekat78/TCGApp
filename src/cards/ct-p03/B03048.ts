// cards/ct-p03/B03048 工藤優作 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【宣言】〚デッキの下に移す〛：レベル7以下のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//
// a1: declared cost=selfToDeckBottom (自身をデッキの下へ) / effect= レベル7以下のキャラを1枚まで選び、スタンさせる。
//     ($pick + target pick query で D08019 a2 / D02013 同型。スタン挙動 (rules/03/24) は sceneSetState:'stun' で engine が担保)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 〚デッキの下に移す〛 (このキャラ自身をデッキの下へ)
  cost: { kind: 'selfToDeckBottom' },
  // レベル7以下のキャラを1枚まで選び、スタンさせる。
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
            query: { area: 'scene', side: 'either', filter: { levelMax: 7 } },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description: '【宣言】〚デッキの下に移す〛：レベル7以下のキャラを1枚まで選び、スタンさせる。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/03-field-areas.md', 'rules/24-qa-naming-stun.md'],
};

export const B03048: CardDef = {
  id: 'B03048',
  no: '0303/B03048',
  kind: 'character',
  names: ['工藤優作'],
  colors: ['白'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['小説家'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1729133385771815.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};
