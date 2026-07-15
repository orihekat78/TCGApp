// cards/ct-p04/B04018P 遠山和葉 (パラレル) — B04018 と公式同文
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md,
//        20-color-and-switch.md, 21-declared-ability-cost.md,
//        24-qa-naming-stun.md, 25-qa-effects-resolution.md

import { buildB04018Variant } from './B04018.shared.js';
import type { CardDef } from '@/engine/types';

export const B04018P: CardDef = buildB04018Variant({
  id: 'B04018P',
  no: '0419/B04018P',
  rarity: 'RP',
  imageUrl: '1735287737381785.jpg',
});
