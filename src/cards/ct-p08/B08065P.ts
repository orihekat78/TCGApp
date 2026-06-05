// cards/ct-p08/B08065P 大和敢助 (キャラ) — catalog-reuse batch
// variant spread of B08065 (same effects, different art/rarity)

import type { CardDef } from '@/engine/types';
import { B08065 } from '../ct-p08/B08065.js';

export const B08065P: CardDef = {
  ...B08065,
  id: 'B08065P',
  no: '0902/B08065P',
  rarity: 'RP',
  imageUrl: '1770878984785309.jpg',
};
