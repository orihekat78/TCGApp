// cards/ct-p06/B06108P 漆黒の特急 (事件 パラレル) — B06108 の絵柄違い (同 cardId 0725)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B06108.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B06108 } from './B06108.js';

export const B06108P: CardDef = {
  ...B06108,
  id: 'B06108P',
  no: '0725/B06108P',
  imageUrl: '1755741761071205.jpg',
  rarity: 'CP',
};
