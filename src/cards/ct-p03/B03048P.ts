// cards/ct-p03/B03048P 工藤優作 (キャラ・パラレル) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// B03048 (工藤優作) の絵柄違いパラレル。能力は同一、id/no/imageUrl/rarity のみ override。

import type { CardDef } from '@/engine/types';
import { B03048 } from './B03048.js';

export const B03048P: CardDef = {
  ...B03048,
  id: 'B03048P',
  no: '0303/B03048P',
  rarity: 'RP',
  imageUrl: '1729133385776985.jpg',
};
