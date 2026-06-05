// cards/pr-01/PR149 怪盗キッド (キャラ) — catalog-reuse batch; D03002 の絵柄違い (同 cardId 0119)
import type { CardDef } from '@/engine/types';
import { D03002 } from '../ct-d03/D03002.js';

export const PR149: CardDef = {
  ...D03002,
  id: 'PR149',
  no: '0119/PR149',
  imageUrl: '1747874045641650.jpg',
  rarity: 'PR',
};
