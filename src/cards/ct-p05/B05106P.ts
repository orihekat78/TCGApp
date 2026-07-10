// cards/ct-p05/B05106P ジン＆ウォッカ (キャラ パラレル) — B05106 の絵柄違い (同 cardId 0602)
// TSV 全列同文 (rarity MRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B05106.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B05106 } from './B05106.js';

export const B05106P: CardDef = {
  ...B05106,
  id: 'B05106P',
  no: '0602/B05106P',
  imageUrl: '1747231561653777.jpg',
  rarity: 'MRP',
};
