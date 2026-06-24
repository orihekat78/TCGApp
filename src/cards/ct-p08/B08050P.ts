// cards/ct-p08/B08050P 宮野明美 (character RP、B08050 パラレル — テキスト同一) — engine変更0
// 公式テキスト・句マッピング・certify 根拠は B08050.ts を参照 (cardNum 0888 同一、絵柄/rarity 違いのみ)。

import type { CardDef } from '@/engine/types';
import { B08050 } from './B08050.js';

export const B08050P: CardDef = {
  ...B08050,
  id: 'B08050P',
  no: '0888/B08050P',
  rarity: 'RP',
  imageUrl: '1770878984727540.jpg',
};
