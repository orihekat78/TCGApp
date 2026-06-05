// cards/ct-p05/B05112 バーボン (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】：手札から【カットイン】を持つレベル5以下の【黒】のキャラを1枚まで登場させる。
//
// a1: 【宣言】【スリープ】コストで、手札から カットイン持ち Lv5以下 黒 のキャラを1枚まで登場 (sceneEnter from hand 短縮形)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' }, // 【宣言】【スリープ】 (もともと sleep / stun なら canPay=false で宣言不可)
  // 手札から【カットイン】を持つレベル5以下の【黒】のキャラを1枚まで登場させる (from:'hand' 短縮形 / 候補0件なら skip)
  effect: { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { keyword: 'カットイン', levelMax: 5, color: '黒' } } },
  description: '【宣言】【スリープ】：手札から【カットイン】を持つレベル5以下の【黒】のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};

export const B05112: CardDef = {
  id: 'B05112',
  no: '0608/B05112',
  kind: 'character',
  names: ['バーボン'],
  colors: ['黒'],
  level: 6,
  ap: 4000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322246361259.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
  ],
};
