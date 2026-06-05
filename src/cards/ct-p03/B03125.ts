// cards/ct-p03/B03125 沼淵己一郎 (キャラ) — catalog-reuse batch
// rules: 11-reasoning.md, 13-keywords.md, 17-icons.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//
// a1: 〚ミスリード1〛 — misreadX({ x:1 }) 共通クラス (reasoning:before-add listener が処理、icon-misread)

import type { CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

// a1: 〚ミスリード1〛 (相手推理時にスリープして LP-1、reasoning:before-add listener が解決)
const a1 = misreadX({ x: 1, abilityId: 'a1' });

export const B03125: CardDef = {
  id: 'B03125',
  no: '0374/B03125',
  kind: 'character',
  names: ['沼淵己一郎'],
  colors: ['黒'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133510391364.jpg',
  abilities: [a1],
  ruleRefs: ['rules/11-reasoning.md', 'rules/13-keywords.md', 'rules/17-icons.md'],
};
