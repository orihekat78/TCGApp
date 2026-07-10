// cards/ct-p03/B03041P 直球勝負 (イベント パラレル) — B03041 の絵柄違い (同 cardId 0298)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03041.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03041 } from './B03041.js';

export const B03041P: CardDef = {
  ...B03041,
  id: 'B03041P',
  no: '0298/B03041P',
  imageUrl: '1729133249359590.jpg',
  rarity: 'CP',
};
