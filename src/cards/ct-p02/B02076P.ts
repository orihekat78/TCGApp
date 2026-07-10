// cards/ct-p02/B02076P 大和敢助 (キャラ パラレル) — B02076 の絵柄違い (同 cardId 0237)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B02076.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B02076 } from './B02076.js';

export const B02076P: CardDef = {
  ...B02076,
  id: 'B02076P',
  no: '0237/B02076P',
  imageUrl: '1721357284520795.jpg',
  rarity: 'RP',
};
