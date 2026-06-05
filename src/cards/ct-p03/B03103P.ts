// cards/ct-p03/B03103P ヤンチャな5人組 (イベント・パラレル) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// base B03103 を spread (rarity / imageUrl override)。

import { B03103 } from './B03103.js';
import type { CardDef } from '@/engine/types';

export const B03103P: CardDef = {
  ...B03103,
  id: 'B03103P',
  no: '0356/B03103P',
  rarity: 'CP',
  imageUrl: '1729133463330228.jpg',
};
