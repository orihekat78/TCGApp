// cards/ct-p03/B03129P ベルモット (キャラ) — exact-reprint batch (2026-06-06 タスクA)
// variant spread of B03129 (絵柄違い / rarity CP)。公式テキスト byte 一致のため abilities 完全流用。
import type { CardDef } from '@/engine/types';
import { B03129 } from './B03129.js';

export const B03129P: CardDef = {
  ...B03129,
  id: 'B03129P',
  no: '0378/B03129P',
  rarity: 'CP',
  imageUrl: '1729133510419734.jpg',
};
