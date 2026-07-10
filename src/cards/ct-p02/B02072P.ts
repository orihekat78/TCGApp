// cards/ct-p02/B02072P 降谷零 (キャラ パラレル) — B02072 の絵柄違い (同 cardId 0233)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B02072.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B02072 } from './B02072.js';

export const B02072P: CardDef = {
  ...B02072,
  id: 'B02072P',
  no: '0233/B02072P',
  imageUrl: '1721357267371298.jpg',
  rarity: 'SRP',
};
