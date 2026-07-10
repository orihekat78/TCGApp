// cards/ct-p01/B01005P 江戸川コナン (キャラ パラレル) — B01005 の絵柄違い (同 cardId 0001)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B01005.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B01005 } from './B01005.js';

export const B01005P: CardDef = {
  ...B01005,
  id: 'B01005P',
  no: '0001/B01005P',
  imageUrl: '1734349765557282.jpg',
  rarity: 'SRP',
};
