// cards/pr-01/PR147 工藤新一 (キャラ) — catalog-reuse batch; D01004 の絵柄違い (同 cardId)
import type { CardDef } from '@/engine/types';
import { D01004 } from '../ct-d01/D01004.js';

export const PR147: CardDef = {
  ...D01004,
  id: 'PR147',
  no: '0093/PR147',
  imageUrl: '1747874045631905.jpg', rarity: 'PR',
};
