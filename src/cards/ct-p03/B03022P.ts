// cards/ct-p03/B03022P 若狭留美 (キャラ・パラレル) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 24-qa-naming-stun.md
//
// B03022 (若狭留美) の絵柄違いパラレル。能力は同一、id/no/imageUrl/rarity のみ override。

import type { CardDef } from '@/engine/types';
import { B03022 } from './B03022.js';

export const B03022P: CardDef = {
  ...B03022,
  id: 'B03022P',
  no: '0280/B03022P',
  rarity: 'CP',
  imageUrl: '1729133201264730.jpg',
};
