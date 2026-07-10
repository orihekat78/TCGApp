// cards/ct-p06/B06072P かぐや (キャラ パラレル) — B06072 の絵柄違い (同 cardId 0693)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B06072.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B06072 } from './B06072.js';

export const B06072P: CardDef = {
  ...B06072,
  id: 'B06072P',
  no: '0693/B06072P',
  imageUrl: '1755684967072752.jpg',
  rarity: 'RP',
};
