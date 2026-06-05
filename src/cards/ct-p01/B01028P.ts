// cards/ct-p01/B01028P 服部平次 (キャラ) — catalog-reuse batch
// variant spread of B01028 (絵柄違い / rarity SRP)。
import type { CardDef } from '@/engine/types';
import { B01028 } from './B01028.js';

export const B01028P: CardDef = {
  ...B01028,
  id: 'B01028P',
  no: '0022/B01028P',
  rarity: 'SRP',
  imageUrl: '1714013000984316.jpg',
};
