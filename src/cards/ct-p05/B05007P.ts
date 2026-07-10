// cards/ct-p05/B05007P 妃英理 (キャラ パラレル) — B05007 の絵柄違い (同 cardId 0513)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B05007.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B05007 } from './B05007.js';

export const B05007P: CardDef = {
  ...B05007,
  id: 'B05007P',
  no: '0513/B05007P',
  imageUrl: '1747231489417924.jpg',
  rarity: 'RP',
};
