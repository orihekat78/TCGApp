// cards/ct-p03/B03110P ジン (キャラ パラレル) — B03110 の絵柄違い (同 cardId 0359)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03110.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03110 } from './B03110.js';

export const B03110P: CardDef = {
  ...B03110,
  id: 'B03110P',
  no: '0359/B03110P',
  imageUrl: '1729133482949680.jpg',
  rarity: 'SRP',
};
