// cards/ct-p05/B05120P 集められた名探偵 (事件 パラレル) — B05120 の絵柄違い (同 cardId 0616)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B05120.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B05120 } from './B05120.js';

export const B05120P: CardDef = {
  ...B05120,
  id: 'B05120P',
  no: '0616/B05120P',
  imageUrl: '1747231561690637.jpg',
  rarity: 'CP',
};
