// cards/ct-p02/B02031P 平次のバイク (イベント パラレル) — B02031 の絵柄違い (同 cardId 0201)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B02031.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B02031 } from './B02031.js';

export const B02031P: CardDef = {
  ...B02031,
  id: 'B02031P',
  no: '0201/B02031P',
  imageUrl: '1721357211031413.jpg',
  rarity: 'CP',
};
