// cards/pr-01/PR151 降谷零 (キャラ) — catalog-reuse batch; D05002 の絵柄違い (同 cardId 0147)
import type { CardDef } from '@/engine/types';
import { D05002 } from '../ct-d05/D05002.js';

export const PR151: CardDef = {
  ...D05002,
  id: 'PR151',
  no: '0147/PR151',
  imageUrl: '1747874045651303.jpg',
  rarity: 'PR',
};
