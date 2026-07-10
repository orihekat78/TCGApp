// cards/ct-p04/B04091P ウォッカ (キャラ パラレル) — B04091 の絵柄違い (同 cardId 0473)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B04091.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B04091 } from './B04091.js';

export const B04091P: CardDef = {
  ...B04091,
  id: 'B04091P',
  no: '0473/B04091P',
  imageUrl: '1735287841317708.jpg',
  rarity: 'CP',
};
