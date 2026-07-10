// cards/ct-p02/B02018P 服部平次 (キャラ パラレル) — B02018 の絵柄違い (同 cardId 0188)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B02018.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B02018 } from './B02018.js';

export const B02018P: CardDef = {
  ...B02018,
  id: 'B02018P',
  no: '0188/B02018P',
  imageUrl: '1721357188615979.jpg',
  rarity: 'SRP',
};
