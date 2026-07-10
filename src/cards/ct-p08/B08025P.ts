// cards/ct-p08/B08025P 伊織無我 (キャラ パラレル) — B08025 の絵柄違い (同 cardId 0865)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B08025.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B08025 } from './B08025.js';

export const B08025P: CardDef = {
  ...B08025,
  id: 'B08025P',
  no: '0865/B08025P',
  imageUrl: '1770878966432520.jpg',
  rarity: 'CP',
};
