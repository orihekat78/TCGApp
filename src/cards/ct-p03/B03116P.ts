// cards/ct-p03/B03116P ウォッカ (キャラ パラレル) — B03116 の絵柄違い (同 cardId 0365)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03116.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03116 } from './B03116.js';

export const B03116P: CardDef = {
  ...B03116,
  id: 'B03116P',
  no: '0365/B03116P',
  imageUrl: '1729133483017256.jpg',
  rarity: 'CP',
};
