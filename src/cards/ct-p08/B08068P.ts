// cards/ct-p08/B08068P 安室透 (キャラ パラレル) — B08068 の絵柄違い (同 cardId 0905)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B08068.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B08068 } from './B08068.js';

export const B08068P: CardDef = {
  ...B08068,
  id: 'B08068P',
  no: '0905/B08068P',
  imageUrl: '1770878984805498.jpg',
  rarity: 'CP',
};
