// cards/ct-p05/B05029P 大岡紅葉 (キャラ) — exact-reprint batch (2026-06-06 タスクA)
// variant spread of B05029 (絵柄違い / rarity RP)。公式テキスト byte 一致のため abilities 完全流用。
import type { CardDef } from '@/engine/types';
import { B05029 } from './B05029.js';

export const B05029P: CardDef = {
  ...B05029,
  id: 'B05029P',
  no: '0533/B05029P',
  rarity: 'RP',
  imageUrl: '1747231524106326.jpg',
};
