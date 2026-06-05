// cards/ct-p03/B03054P 鈴木園子 (キャラ・パラレル) — catalog-reuse batch
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// B03054 (鈴木園子) の絵柄違いパラレル。能力は同一、id/no/imageUrl/rarity のみ override。

import type { CardDef } from '@/engine/types';
import { B03054 } from './B03054.js';

export const B03054P: CardDef = {
  ...B03054,
  id: 'B03054P',
  no: '0309/B03054P',
  rarity: 'CP',
  imageUrl: '1729133385828928.jpg',
};
