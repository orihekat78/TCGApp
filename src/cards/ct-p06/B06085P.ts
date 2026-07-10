// cards/ct-p06/B06085P 松田陣平 (キャラ パラレル) — B06085 の絵柄違い (同 cardId 0704)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B06085.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B06085 } from './B06085.js';

export const B06085P: CardDef = {
  ...B06085,
  id: 'B06085P',
  no: '0704/B06085P',
  imageUrl: '1755684967123029.jpg',
  rarity: 'SRP',
};
