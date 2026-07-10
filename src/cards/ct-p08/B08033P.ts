// cards/ct-p08/B08033P 工藤有希子 (キャラ パラレル) — B08033 の絵柄違い (同 cardId 0872)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B08033.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B08033 } from './B08033.js';

export const B08033P: CardDef = {
  ...B08033,
  id: 'B08033P',
  no: '0872/B08033P',
  imageUrl: '1770878966457451.jpg',
  rarity: 'SRP',
};
