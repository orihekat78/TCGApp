// cards/ct-p04/B04032P 白馬探 (キャラ パラレル) — B04032 の絵柄違い (同 cardId 0430)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B04032.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B04032 } from './B04032.js';

export const B04032P: CardDef = {
  ...B04032,
  id: 'B04032P',
  no: '0430/B04032P',
  imageUrl: '1735287759472007.jpg',
  rarity: 'RP',
};
