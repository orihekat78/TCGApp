// cards/ct-p05/B05055 鈴木史郎 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 13-keywords.md, 15-abilities-effects.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】：手札からレベル5以下の〚特徴［鈴木財閥］〛のキャラを1枚まで登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［鈴木財閥］〛のキャラを1枚まで選び、手札に加える。
//
// a1: 【宣言】【スリープ】cost → 手札から Lv5以下[鈴木財閥]を1枚まで登場 (sceneEnter from:'hand' / D11014 a2 同型の手札登場)
// a2: 【ヒラメキ】リムーブの[鈴木財閥]を1枚まで選び、手札に加える (D11012 a2 / B04025 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' }, // 【スリープ】(もともと sleep / stun なら canPay=false で宣言不可)
  // 手札からレベル5以下の[鈴木財閥]のキャラを1枚まで登場させる (候補 0 件 / user skip OK)
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self', cardId: '$pick.cardId', from: 'hand', viaEffect: true,
          target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { trait: '鈴木財閥', levelMax: 5 } }, n: { min: 0, max: 1 }, chooser: 'self' },
        },
      },
    ],
  },
  description: '【宣言】【スリープ】：手札からレベル5以下の[鈴木財閥]のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // 自分のリムーブエリアにある[鈴木財閥]のキャラを1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { trait: '鈴木財閥' } } },
  description: '【ヒラメキ】リムーブの[鈴木財閥]のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/19-special-rules.md'],
};

export const B05055: CardDef = {
  id: 'B05055',
  no: '0557/B05055',
  kind: 'character',
  names: ['鈴木史郎'],
  colors: ['白'],
  level: 6,
  ap: 4000,
  lp: 1,
  traits: ['鈴木財閥'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322205539100.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
