// cards/ct-p08/B08004P 江戸川コナン (キャラ パラレル) — B08004 の絵柄違い (同 cardId 0845)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B08004.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B08004 } from './B08004.js';

export const B08004P: CardDef = {
  ...B08004,
  id: 'B08004P',
  no: '0845/B08004P',
  imageUrl: '1771319691202961.jpg',
  rarity: 'RP',
};
