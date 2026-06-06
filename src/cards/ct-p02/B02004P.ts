// cards/ct-p02/B02004P 毛利蘭 (キャラ) — exact-reprint batch (2026-06-06 タスクA)
// variant spread of B02004 (絵柄違い / rarity RP)。公式テキスト byte 一致のため abilities 完全流用。
import type { CardDef } from '@/engine/types';
import { B02004 } from './B02004.js';

export const B02004P: CardDef = {
  ...B02004,
  id: 'B02004P',
  no: '0176/B02004P',
  rarity: 'RP',
  imageUrl: '1721357158825617.jpg',
};
