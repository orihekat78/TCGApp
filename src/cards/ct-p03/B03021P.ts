// cards/ct-p03/B03021P 吉田歩美 (キャラ・パラレル) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// B03021 (吉田歩美) の絵柄違いパラレル。能力は同一、id/no/imageUrl/rarity のみ override。

import type { CardDef } from '@/engine/types';
import { B03021 } from './B03021.js';

export const B03021P: CardDef = {
  ...B03021,
  id: 'B03021P',
  no: '0279/B03021P',
  rarity: 'CP',
  imageUrl: '1729133201253035.jpg',
};
