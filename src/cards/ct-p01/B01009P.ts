// cards/ct-p01/B01009P 工藤新一 (キャラ パラレル) — B01009 の絵柄違い (同 cardId 0005)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B01009.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B01009 } from './B01009.js';

export const B01009P: CardDef = {
  ...B01009,
  id: 'B01009P',
  no: '0005/B01009P',
  imageUrl: '1734349765589682.jpg',
  rarity: 'RP',
};
