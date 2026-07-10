// cards/ct-p06/B06109P 紅の修学旅行 (事件 パラレル) — B06109 の絵柄違い (同 cardId 0726)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B06109.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B06109 } from './B06109.js';

export const B06109P: CardDef = {
  ...B06109,
  id: 'B06109P',
  no: '0726/B06109P',
  imageUrl: '1755741761079181.jpg',
  rarity: 'CP',
};
