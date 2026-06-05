// cards/ct-p09/B09025P 綾小路文麿 (キャラ・パラレル) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// B09025 の絵柄違い (CP)。能力同一のため spread で id/no/imageUrl/rarity のみ override。

import type { CardDef } from '@/engine/types';
import { B09025 } from './B09025.js';

export const B09025P: CardDef = {
  ...B09025,
  id: 'B09025P',
  no: '0969/B09025P',
  rarity: 'CP',
  imageUrl: '1775608819123897.jpg',
};
