// cards/ct-p09/B09046P 鈴木次郎吉 (キャラ・パラレル) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// B09046 の絵柄違い (CP)。能力同一のため spread で id/no/imageUrl/rarity のみ override。

import type { CardDef } from '@/engine/types';
import { B09046 } from './B09046.js';

export const B09046P: CardDef = {
  ...B09046,
  id: 'B09046P',
  no: '0989/B09046P',
  rarity: 'CP',
  imageUrl: '1775608856171618.jpg',
};
