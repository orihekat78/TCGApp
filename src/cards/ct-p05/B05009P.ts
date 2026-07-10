// cards/ct-p05/B05009P 毛利蘭 (キャラ パラレル) — B05009 の絵柄違い (同 cardId 0515)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B05009.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B05009 } from './B05009.js';

export const B05009P: CardDef = {
  ...B05009,
  id: 'B05009P',
  no: '0515/B05009P',
  imageUrl: '1747231489428217.jpg',
  rarity: 'RP',
};
