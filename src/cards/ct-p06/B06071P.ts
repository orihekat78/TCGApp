// cards/ct-p06/B06071P 「閃光弾!?」 (イベント, パラレル) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 24-qa-naming-stun.md
// 同一 cardId 0692 の絵柄違い。base B06071 を import して spread。

import type { CardDef } from '@/engine/types';
import { B06071 } from './B06071.js';

export const B06071P: CardDef = {
  ...B06071,
  id: 'B06071P',
  no: '0692/B06071P',
  rarity: 'CP',
  imageUrl: '1755684967066589.jpg',
};
