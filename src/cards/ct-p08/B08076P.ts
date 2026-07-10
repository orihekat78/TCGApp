// cards/ct-p08/B08076P 揺れる警視庁 1200万人の人質 (事件 パラレル) — B08076 の絵柄違い (同 cardId 0913)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B08076.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B08076 } from './B08076.js';

export const B08076P: CardDef = {
  ...B08076,
  id: 'B08076P',
  no: '0913/B08076P',
  imageUrl: '1770878984818544.jpg',
  rarity: 'CP',
};
