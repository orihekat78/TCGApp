// cards/ct-p03/B03037 坂田祐介 (キャラ) — catalog-reuse batch
// rules: 11-reasoning.md, 13-keywords.md, 17-icons.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//
// a1: misreadX({x:1}) 共通クラス (reasoning:before-add listener が処理。D08019 等 misread と同型)。

import type { CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

export const B03037: CardDef = {
  id: 'B03037',
  no: '0294/B03037',
  kind: 'character',
  names: ['坂田祐介'],
  colors: ['緑'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '大阪府警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133249330299.jpg',
  abilities: [misreadX({ x: 1, abilityId: 'a1' })],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
  ],
};
