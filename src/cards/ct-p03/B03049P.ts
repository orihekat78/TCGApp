// cards/ct-p03/B03049P 黒羽盗一 (キャラ パラレル) — B03049 の絵柄違い (同 cardId 0304)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03049.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03049 } from './B03049.js';

export const B03049P: CardDef = {
  ...B03049,
  id: 'B03049P',
  no: '0304/B03049P',
  imageUrl: '1729133385788183.jpg',
  rarity: 'RP',
};
