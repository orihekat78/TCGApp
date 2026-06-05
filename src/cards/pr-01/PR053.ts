// cards/pr-01/PR053 工藤新一 (キャラ) — catalog-reuse batch; D01004 の絵柄違い (同 cardId)
import type { CardDef } from '@/engine/types';
import { D01004 } from '../ct-d01/D01004.js';

export const PR053: CardDef = {
  ...D01004,
  id: 'PR053',
  no: '0093/PR053',
  imageUrl: '1732542002084200.jpg', rarity: 'PR',
};
