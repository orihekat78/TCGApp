// cards/pr-01/PR150 赤井秀一 (キャラ) — catalog-reuse batch; D04002 の絵柄違い (同 cardId 0133)
import type { CardDef } from '@/engine/types';
import { D04002 } from '../ct-d04/D04002.js';

export const PR150: CardDef = {
  ...D04002,
  id: 'PR150',
  no: '0133/PR150',
  imageUrl: '1747874045646921.jpg',
  rarity: 'PR',
};
