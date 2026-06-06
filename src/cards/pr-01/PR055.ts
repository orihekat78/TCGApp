// cards/pr-01/PR055 ベルモット (キャラ) — exact-reprint batch (2026-06-06 タスクA)
// promo reprint of B03129 (公式テキスト byte 一致 / rarity PR)。abilities 完全流用。
import type { CardDef } from '@/engine/types';
import { B03129 } from '../ct-p03/B03129.js';

export const PR055: CardDef = {
  ...B03129,
  id: 'PR055',
  no: '0378/PR055',
  rarity: 'PR',
  imageUrl: '193f20d019b166.jpg',
};
