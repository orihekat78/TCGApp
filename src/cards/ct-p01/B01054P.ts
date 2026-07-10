// cards/ct-p01/B01054P 寺井黄之助 (キャラ パラレル) — B01054 の絵柄違い (同 cardId 0046)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B01054.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B01054 } from './B01054.js';

export const B01054P: CardDef = {
  ...B01054,
  id: 'B01054P',
  no: '0046/B01054P',
  imageUrl: '1714013041165487.jpg',
  rarity: 'CP',
};
