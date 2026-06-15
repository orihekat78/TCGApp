// cards/ct-p02/B02020P 大岡紅葉 (パラレル) — B02020 と同型 (同一 cardId 0190、絵柄違い)。
// a1 解禁 (engine拡張 wave#2 cluster9 setcard:leave hook) + a2。能力は base B02020 を spread。

import type { CardDef } from '@/engine/types';
import { B02020 } from './B02020.js';

export const B02020P: CardDef = {
  ...B02020,
  id: 'B02020P',
  no: '0190/B02020P',
  rarity: 'SRP',
  imageUrl: '1721357188629969.jpg',
};
