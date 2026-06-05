// cards/ct-p07/B07016P 服部平次 (キャラ, パラレル) — catalog-reuse batch
// 同一 cardId 0748 の絵柄違い。base B07016 を import して spread。
import type { CardDef } from '@/engine/types';
import { B07016 } from './B07016.js';

export const B07016P: CardDef = {
  ...B07016,
  id: 'B07016P',
  no: '0748/B07016P',
  rarity: 'SRP',
  imageUrl: '1763546798302254.jpg',
};
