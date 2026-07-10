// cards/ct-p03/B03111P バーボン (キャラ パラレル) — B03111 の絵柄違い (同 cardId 0360)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03111.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03111 } from './B03111.js';

export const B03111P: CardDef = {
  ...B03111,
  id: 'B03111P',
  no: '0360/B03111P',
  imageUrl: '1729133482962655.jpg',
  rarity: 'SRP',
};
