// cards/ct-p09/B09044P 工藤有希子 (キャラ・パラレル) — catalog-reuse batch
// rules: 10-action-event.md, 15-abilities-effects.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// B09044 の絵柄違い (CP)。能力同一のため spread で id/no/imageUrl/rarity のみ override。

import type { CardDef } from '@/engine/types';
import { B09044 } from './B09044.js';

export const B09044P: CardDef = {
  ...B09044,
  id: 'B09044P',
  no: '0987/B09044P',
  rarity: 'CP',
  imageUrl: '1775608856145835.jpg',
};
