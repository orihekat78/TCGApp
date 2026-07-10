// cards/ct-p07/B07014P 弁当型携帯FAX (イベント パラレル) — B07014 の絵柄違い (同 cardId 0746)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B07014.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B07014 } from './B07014.js';

export const B07014P: CardDef = {
  ...B07014,
  id: 'B07014P',
  no: '0746/B07014P',
  imageUrl: '1763546798287878.jpg',
  rarity: 'CP',
};
