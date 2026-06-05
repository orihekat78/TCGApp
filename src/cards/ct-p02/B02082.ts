// cards/ct-p02/B02082 山村ミサオ (キャラ) — catalog-reuse batch
// rules: 11-reasoning.md, 13-keywords.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//
// a1: 〚ミスリード1〛 — misreadX(1) 共通クラス (reasoning:before-add 経由)

import type { CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

export const B02082: CardDef = {
  id: 'B02082',
  no: '0243/B02082',
  kind: 'character',
  names: ['山村ミサオ'],
  colors: ['黄'],
  level: 3,
  ap: 3000,
  lp: 0,
  traits: ['警察', '群馬県警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357284546770.jpg',
  abilities: [misreadX({ x: 1, abilityId: 'a1' })],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
  ],
};
