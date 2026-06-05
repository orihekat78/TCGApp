// cards/ct-p08/B08056 宮野厚司 (キャラ) — catalog-reuse batch
// rules: 12-next-hint.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【FILE5】【宣言】【スリープ】：手札からレベル7以下の〚カード名［宮野エレーナ］〛か〚［宮野志保］〛か〚［宮野明美］〛を1枚まで登場させる。
//
// a1: 【FILE5】(condition: fileAtLeast 5) 【宣言】【スリープ】(cost: sleepSelf) →
//     手札から Lv7以下 かつ カード名[宮野エレーナ/宮野志保/宮野明美] を1枚まで登場 (B05055 a1 / D11014 a2 同型の手札登場)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【FILE5】= 自分の FILE エリアが5枚以上のときに宣言可
  condition: { kind: 'fileAtLeast', n: 5 },
  cost: { kind: 'sleepSelf' }, // 【スリープ】(もともと sleep / stun なら canPay=false で宣言不可)
  // 手札からレベル7以下の[宮野エレーナ]か[宮野志保]か[宮野明美]を1枚まで登場させる (候補 0 件 / user skip OK)
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self', cardId: '$pick.cardId', from: 'hand', viaEffect: true,
          target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: ['宮野エレーナ', '宮野志保', '宮野明美'], levelMax: 7 } }, n: { min: 0, max: 1 }, chooser: 'self' },
        },
      },
    ],
  },
  description: '【FILE5】【宣言】【スリープ】：手札からレベル7以下の[宮野エレーナ]か[宮野志保]か[宮野明美]を1枚まで登場させる。',
  ruleRefs: ['rules/12-next-hint.md', 'rules/21-declared-ability-cost.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

export const B08056: CardDef = {
  id: 'B08056',
  no: '0894/B08056',
  kind: 'character',
  names: ['宮野厚司'],
  colors: ['赤'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['科学者', '医師'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731238657766.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
