// cards/ct-p09/B09095P ベルモット (キャラ パラレル) — B09095 の絵柄違い (同 cardId 1034)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B09095.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B09095 } from './B09095.js';

export const B09095P: CardDef = {
  ...B09095,
  id: 'B09095P',
  no: '1034/B09095P',
  imageUrl: '1775608926505884.jpg',
  rarity: 'RP',
};
