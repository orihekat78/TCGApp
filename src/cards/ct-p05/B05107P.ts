// cards/ct-p05/B05107P ウォッカ (キャラ パラレル) — B05107 の絵柄違い (同 cardId 0603)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B05107.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B05107 } from './B05107.js';

export const B05107P: CardDef = {
  ...B05107,
  id: 'B05107P',
  no: '0603/B05107P',
  imageUrl: '1747231561658424.jpg',
  rarity: 'SRP',
};
