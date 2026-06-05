// cards/ct-p05/B05037 桧原ひかる (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 12-next-hint.md, 15-abilities-effects.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】〚FILEエリアにあるカードを上から1枚リムーブする〛：カードを2枚引く。
//
// a1: 【宣言】cost = sleepSelf + fileFrom(1) (FILE上から1枚リムーブ) → draw 2 (D08005 a2 / D11012 a1 同型の宣言能力)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】+〚FILEエリアにあるカードを上から1枚リムーブする〛 をコストとして両方支払う (rules/21)
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'fileFrom', n: 1 }] },
  // カードを2枚引く。
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
  description: '【宣言】【スリープ】〚FILEエリアにあるカードを上から1枚リムーブする〛：カードを2枚引く。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/12-next-hint.md', 'rules/03-field-areas.md'],
};

export const B05037: CardDef = {
  id: 'B05037',
  no: '0541/B05037',
  kind: 'character',
  names: ['桧原ひかる'],
  colors: ['緑'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['メイド'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322178475886.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
