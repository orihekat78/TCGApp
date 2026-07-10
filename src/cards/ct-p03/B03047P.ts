// cards/ct-p03/B03047P 京極真 (キャラ パラレル) — B03047 の絵柄違い (同 cardId 0302)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03047.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03047 } from './B03047.js';

export const B03047P: CardDef = {
  ...B03047,
  id: 'B03047P',
  no: '0302/B03047P',
  imageUrl: '1729133385765419.jpg',
  rarity: 'SRP',
};
