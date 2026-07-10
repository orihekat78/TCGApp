// cards/ct-p05/B05027P 服部平次＆遠山和葉 (キャラ パラレル) — B05027 の絵柄違い (同 cardId 0531)
// TSV 全列同文 (rarity MRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B05027.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B05027 } from './B05027.js';

export const B05027P: CardDef = {
  ...B05027,
  id: 'B05027P',
  no: '0531/B05027P',
  imageUrl: '1747231489469297.jpg',
  rarity: 'MRP',
};
