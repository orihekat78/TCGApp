// cards/ct-p02/B02006P 仮面ヤイバー (キャラ パラレル) — B02006 の絵柄違い (同 cardId 0178)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B02006.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B02006 } from './B02006.js';

export const B02006P: CardDef = {
  ...B02006,
  id: 'B02006P',
  no: '0178/B02006P',
  imageUrl: '1721357158839417.jpg',
  rarity: 'RP',
};
