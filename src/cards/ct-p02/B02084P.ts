// cards/ct-p02/B02084P 安室の愛車 (イベント パラレル) — B02084 の絵柄違い (同 cardId 0245)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B02084.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B02084 } from './B02084.js';

export const B02084P: CardDef = {
  ...B02084,
  id: 'B02084P',
  no: '0245/B02084P',
  imageUrl: '1721357284556527.jpg',
  rarity: 'CP',
};
