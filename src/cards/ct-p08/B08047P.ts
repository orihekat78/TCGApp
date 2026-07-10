// cards/ct-p08/B08047P 沖矢昴 (キャラ パラレル) — B08047 の絵柄違い (同 cardId 0885)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B08047.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B08047 } from './B08047.js';

export const B08047P: CardDef = {
  ...B08047,
  id: 'B08047P',
  no: '0885/B08047P',
  imageUrl: '1770878984714714.jpg',
  rarity: 'SRP',
};
