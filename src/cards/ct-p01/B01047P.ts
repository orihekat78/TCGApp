// cards/ct-p01/B01047P 黒羽快斗 (キャラ パラレル) — B01047 の絵柄違い (同 cardId 0039)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B01047.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B01047 } from './B01047.js';

export const B01047P: CardDef = {
  ...B01047,
  id: 'B01047P',
  no: '0039/B01047P',
  imageUrl: '1714013020319710.jpg',
  rarity: 'RP',
};
