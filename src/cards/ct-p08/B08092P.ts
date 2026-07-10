// cards/ct-p08/B08092P 出来損ないの名探偵 (イベント パラレル) — B08092 の絵柄違い (同 cardId 0928)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B08092.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B08092 } from './B08092.js';

export const B08092P: CardDef = {
  ...B08092,
  id: 'B08092P',
  no: '0928/B08092P',
  imageUrl: '1770878999180582.jpg',
  rarity: 'CP',
};
