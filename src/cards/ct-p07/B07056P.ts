// cards/ct-p07/B07056P 怪盗キッドと中森王女 (イベント) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// B07056 のパラレル (CP)。本体は base を spread。

import { B07056 } from '../ct-p07/B07056.js';
import type { CardDef } from '@/engine/types';

export const B07056P: CardDef = {
  ...B07056,
  id: 'B07056P',
  no: '0785/B07056P',
  rarity: 'CP',
  imageUrl: '1763546809967467.jpg',
};
