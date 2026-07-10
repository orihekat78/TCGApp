// cards/ct-p01/B01081P 安室透 (キャラ パラレル) — B01081 の絵柄違い (同 cardId 0069)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B01081.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B01081 } from './B01081.js';

export const B01081P: CardDef = {
  ...B01081,
  id: 'B01081P',
  no: '0069/B01081P',
  imageUrl: '1714013067517415.jpg',
  rarity: 'SRP',
};
