// cards/ct-p09/B09105P キッ (event, パラレル) — B09105 の完全 clone (id/no/rarity/imageUrl のみ差替)
// テキスト・句マッピングは B09105 を参照 (同一 ability)。

import type { CardDef } from '@/engine/types';
import { B09105 } from './B09105';

export const B09105P: CardDef = {
  ...B09105,
  id: 'B09105P',
  no: '1044/B09105P',
  rarity: 'CP',
  imageUrl: '1775608943981358.jpg',
};
