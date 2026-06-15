// cards/ct-p07/B07034P 小泉紅子 (パラレル) — B07034 と同型 (同一 cardId 0763、絵柄違い)。
// engine拡張 wave#2 cluster9 (setcard:leave hook)。能力は base を spread。

import type { CardDef } from '@/engine/types';
import { B07034 } from './B07034.js';

export const B07034P: CardDef = {
  ...B07034,
  id: 'B07034P',
  no: '0763/B07034P',
  rarity: 'RP',
  imageUrl: '1763546809900958.jpg',
};
