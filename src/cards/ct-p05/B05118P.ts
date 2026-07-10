// cards/ct-p05/B05118P 裏切りの制裁 (事件 パラレル) — B05118 の絵柄違い (同 cardId 0614)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B05118.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B05118 } from './B05118.js';

export const B05118P: CardDef = {
  ...B05118,
  id: 'B05118P',
  no: '0614/B05118P',
  imageUrl: '1747231561680396.jpg',
  rarity: 'CP',
};
