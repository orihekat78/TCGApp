// cards/ct-p09/B09037P 工藤優作 (キャラ・パラレル) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// B09037 の絵柄違い (RP)。能力同一のため spread で id/no/imageUrl/rarity のみ override。

import type { CardDef } from '@/engine/types';
import { B09037 } from './B09037.js';

export const B09037P: CardDef = {
  ...B09037,
  id: 'B09037P',
  no: '0980/B09037P',
  rarity: 'RP',
  imageUrl: '1775608835926078.jpg',
};
