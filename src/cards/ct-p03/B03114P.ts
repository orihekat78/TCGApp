// cards/ct-p03/B03114P スコッチ (キャラ, パラレル) — catalog-reuse batch
// 同一 cardId 0363 の絵柄違い。base B03114 を import して spread。
import type { CardDef } from '@/engine/types';
import { B03114 } from './B03114.js';

export const B03114P: CardDef = {
  ...B03114,
  id: 'B03114P',
  no: '0363/B03114P',
  rarity: 'RP',
  imageUrl: '1729133482993598.jpg',
};
