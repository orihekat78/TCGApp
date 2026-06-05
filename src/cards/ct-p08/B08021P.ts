// cards/ct-p08/B08021P 服部平次 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// B08021 のパラレル (RP)。本体は base を spread。

import { B08021 } from '../ct-p08/B08021.js';
import type { CardDef } from '@/engine/types';

export const B08021P: CardDef = {
  ...B08021,
  id: 'B08021P',
  no: '0861/B08021P',
  rarity: 'RP',
  imageUrl: '1770878966420698.jpg',
};
