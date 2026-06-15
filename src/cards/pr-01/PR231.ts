// cards/pr-01/PR231 小泉紅子 (プロモ) — B07034 と公式テキスト同一 (同一 cardId 0763、絵柄違い)。
// engine拡張 wave#2 cluster9 (setcard:leave hook)。能力は base B07034 を spread。

import type { CardDef } from '@/engine/types';
import { B07034 } from '../ct-p07/B07034.js';

export const PR231: CardDef = {
  ...B07034,
  id: 'PR231',
  no: '0763/PR231',
  rarity: 'PR',
  imageUrl: '1774884005612565.jpg',
};
