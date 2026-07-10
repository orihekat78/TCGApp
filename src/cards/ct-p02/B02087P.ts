// cards/ct-p02/B02087P キール (キャラ パラレル) — B02087 の絵柄違い (同 cardId 0248)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B02087.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B02087 } from './B02087.js';

export const B02087P: CardDef = {
  ...B02087,
  id: 'B02087P',
  no: '0248/B02087P',
  imageUrl: '1721357309972744.jpg',
  rarity: 'RP',
};
