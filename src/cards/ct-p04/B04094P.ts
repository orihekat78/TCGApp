// cards/ct-p04/B04094P ジン (キャラ パラレル) — B04094 の絵柄違い (同 cardId 0476)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B04094.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B04094 } from './B04094.js';

export const B04094P: CardDef = {
  ...B04094,
  id: 'B04094P',
  no: '0476/B04094P',
  imageUrl: '1735287841336032.jpg',
  rarity: 'CP',
};
