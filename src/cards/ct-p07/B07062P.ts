// cards/ct-p07/B07062P 緋色の誘惑の巻 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 21-declared-ability-cost.md
//
// B07062 のパラレル (CP)。本体は base を spread。

import { B07062 } from '../ct-p07/B07062.js';
import type { CardDef } from '@/engine/types';

export const B07062P: CardDef = {
  ...B07062,
  id: 'B07062P',
  no: '0791/B07062P',
  rarity: 'CP',
  imageUrl: '1763546825698618.jpg',
};
