// cards/ct-p08/B08023P 大岡紅葉 (character RP、B08023 パラレル — テキスト同一) — engine変更0
// 公式テキスト・句マッピング・certify 根拠は B08023.ts を参照 (cardNum 0863 同一、絵柄/rarity 違いのみ)。

import type { CardDef } from '@/engine/types';
import { B08023 } from './B08023.js';

export const B08023P: CardDef = {
  ...B08023,
  id: 'B08023P',
  no: '0863/B08023P',
  rarity: 'RP',
  imageUrl: '1770878966426282.jpg',
};
