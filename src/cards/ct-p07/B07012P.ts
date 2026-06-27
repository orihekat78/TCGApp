// cards/ct-p07/B07012P 本堂瑛祐 (キャラ, パラレル) — engine変更0
// 同一 cardId 0744 の絵柄違い。base B07012 を import して spread。
import type { CardDef } from '@/engine/types';
import { B07012 } from './B07012.js';

export const B07012P: CardDef = {
  ...B07012,
  id: 'B07012P',
  no: '0744/B07012P',
  rarity: 'CP',
  imageUrl: '1763546798279338.jpg',
};
