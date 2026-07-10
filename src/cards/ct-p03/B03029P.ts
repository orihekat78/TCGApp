// cards/ct-p03/B03029P 遠山和葉 (キャラ パラレル) — B03029 の絵柄違い (同 cardId 0286)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03029.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03029 } from './B03029.js';

export const B03029P: CardDef = {
  ...B03029,
  id: 'B03029P',
  no: '0286/B03029P',
  imageUrl: '1729133249262954.jpg',
  rarity: 'SRP',
};
