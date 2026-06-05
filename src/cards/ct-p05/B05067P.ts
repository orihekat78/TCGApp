// cards/ct-p05/B05067P メアリー (キャラ・パラレル) — catalog-reuse batch
// rules: 03-field-areas.md, 05-turn-phases.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// B05067 のパラレル (絵柄違い)。能力同一、id/no/imageUrl/rarity のみ override。

import type { CardDef } from '@/engine/types';
import { B05067 } from './B05067.js';

export const B05067P: CardDef = {
  ...B05067,
  id: 'B05067P',
  no: '0567/B05067P',
  rarity: 'SRP',
  imageUrl: '1747231524187022.jpg',
};
