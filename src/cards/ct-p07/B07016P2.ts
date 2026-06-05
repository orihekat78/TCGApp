// cards/ct-p07/B07016P2 服部平次 (キャラ, パラレル2) — catalog-reuse batch
// 同一 cardId 0748 の絵柄違い。base B07016 を import して spread。
import type { CardDef } from '@/engine/types';
import { B07016 } from './B07016.js';

export const B07016P2: CardDef = {
  ...B07016,
  id: 'B07016P2',
  no: '0748/B07016P2',
  rarity: 'SRCP',
  imageUrl: '1763546798310157.jpg',
};
