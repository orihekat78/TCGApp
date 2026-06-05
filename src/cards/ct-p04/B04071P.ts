// cards/ct-p04/B04071P 風見裕也 (キャラ・variant) — catalog-reuse batch
// B04071 の別 num (パラレル)。base を spread して id/no/imageUrl/rarity を override。

import type { CardDef } from '@/engine/types';
import { B04071 } from './B04071.js';

export const B04071P: CardDef = {
  ...B04071,
  id: 'B04071P',
  no: '0457/B04071P',
  imageUrl: '1735287822603541.jpg',
  rarity: 'RP',
};
