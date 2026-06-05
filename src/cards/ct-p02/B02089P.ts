// cards/ct-p02/B02089P 探偵甲子園 (事件・パラレル) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   この事件が解決編になったとき、相手はカードを1枚引く。
//
// B02089 の絵柄違い (CP)。能力は同一 — base を spread。

import type { CardDef } from '@/engine/types';
import { B02089 } from './B02089.js';

export const B02089P: CardDef = {
  ...B02089,
  id: 'B02089P',
  no: '0250/B02089P',
  rarity: 'CP',
  imageUrl: '1721357309986311.jpg',
};
