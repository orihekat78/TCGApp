// cards/pr-01/PR148 服部平次 (キャラ) — catalog-reuse batch; D02002 の絵柄違い (同 cardId 0105)
import type { CardDef } from '@/engine/types';
import { D02002 } from '../ct-d02/D02002.js';

export const PR148: CardDef = {
  ...D02002,
  id: 'PR148',
  no: '0105/PR148',
  imageUrl: '1747874045636403.jpg',
  rarity: 'PR',
};
