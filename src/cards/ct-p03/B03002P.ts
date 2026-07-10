// cards/ct-p03/B03002P 江戸川コナン (キャラ パラレル) — B03002 の絵柄違い (同 cardId 0260)
// TSV 全列同文 (rarity SRCP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03002.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03002 } from './B03002.js';

export const B03002P: CardDef = {
  ...B03002,
  id: 'B03002P',
  no: '0260/B03002P',
  imageUrl: '193519fa3ad31b.jpg',
  rarity: 'SRCP',
};
