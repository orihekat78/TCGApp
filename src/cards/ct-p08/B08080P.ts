// cards/ct-p08/B08080P キール (キャラ) — catalog-reuse batch
// variant spread of B08080 (same effects, different art/rarity)

import type { CardDef } from '@/engine/types';
import { B08080 } from '../ct-p08/B08080.js';

export const B08080P: CardDef = {
  ...B08080,
  id: 'B08080P',
  no: '0916/B08080P',
  rarity: 'RP',
  imageUrl: '1770878999167938.jpg',
};
