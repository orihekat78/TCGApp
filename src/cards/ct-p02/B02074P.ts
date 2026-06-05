// cards/ct-p02/B02074P 白鳥任三郎 (キャラ・パラレル) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// variant: B02074 と同一能力 (id/no/imageUrl/rarity のみ override)。

import type { CardDef } from '@/engine/types';
import { B02074 } from './B02074.js';

export const B02074P: CardDef = {
  ...B02074,
  id: 'B02074P',
  no: '0235/B02074P',
  imageUrl: '1721357284507830.jpg',
  rarity: 'RP',
};
