// cards/ct-p07/B07091P 閉ざされた秘密 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 21-declared-ability-cost.md
//
// B07091 のパラレル (CP)。本体は base を spread。

import { B07091 } from '../ct-p07/B07091.js';
import type { CardDef } from '@/engine/types';

export const B07091P: CardDef = {
  ...B07091,
  id: 'B07091P',
  no: '0819/B07091P',
  rarity: 'CP',
  imageUrl: '1763546840448451.jpg',
};
