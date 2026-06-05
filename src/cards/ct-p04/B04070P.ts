// cards/ct-p04/B04070P 高木渉 (キャラ・variant) — catalog-reuse batch
// B04070 の別 num (パラレル)。base を spread して id/no/imageUrl/rarity を override。

import type { CardDef } from '@/engine/types';
import { B04070 } from './B04070.js';

export const B04070P: CardDef = {
  ...B04070,
  id: 'B04070P',
  no: '0456/B04070P',
  imageUrl: '1735287822593083.jpg',
  rarity: 'SRP',
};
