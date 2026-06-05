// cards/ct-p06/B06093 山村ミサオ (キャラ) — catalog-reuse batch
// rules: 11-reasoning.md, 13-keywords.md, 17-icons.md
//
// 公式テキスト:
//   〚ミスリード2〛（相手の推理に対し、スリープさせることでLP－2する）
//
// a1: 〚ミスリード2〛 — misreadX({ x:2 }) 共通クラス (reasoning:before-add listener が処理)

import type { CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

// a1: 〚ミスリード2〛
const a1 = misreadX({ x: 2, abilityId: 'a1' });

export const B06093: CardDef = {
  id: 'B06093',
  no: '0712/B06093',
  kind: 'character',
  names: ['山村ミサオ'],
  colors: ['黄'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['警察', '群馬県警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285264344953.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
  ],
};
