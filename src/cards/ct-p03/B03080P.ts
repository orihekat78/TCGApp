// cards/ct-p03/B03080P BANG (イベント パラレル) — B03080 の絵柄違い (同 cardId 0334)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03080.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03080 } from './B03080.js';

export const B03080P: CardDef = {
  ...B03080,
  id: 'B03080P',
  no: '0334/B03080P',
  imageUrl: '1729133424909254.jpg',
  rarity: 'CP',
};
