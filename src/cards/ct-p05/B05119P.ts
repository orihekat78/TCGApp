// cards/ct-p05/B05119P 裏切りの矛先 (事件 パラレル) — B05119 の絵柄違い (同 cardId 0615)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B05119.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B05119 } from './B05119.js';

export const B05119P: CardDef = {
  ...B05119,
  id: 'B05119P',
  no: '0615/B05119P',
  imageUrl: '1747231561685949.jpg',
  rarity: 'CP',
};
