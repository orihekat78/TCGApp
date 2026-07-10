// cards/ct-p06/B06090P 榎本梓 (キャラ パラレル) — B06090 の絵柄違い (同 cardId 0709)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B06090.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B06090 } from './B06090.js';

export const B06090P: CardDef = {
  ...B06090,
  id: 'B06090P',
  no: '0709/B06090P',
  imageUrl: '1755684967145287.jpg',
  rarity: 'CP',
};
