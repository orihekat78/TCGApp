// cards/ct-p09/B09011P (キャラ パラレル) — B09011 の絵柄違い (同 cardId 0956)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B09011.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B09011 } from './B09011.js';

export const B09011P: CardDef = {
  ...B09011,
  id: 'B09011P',
  no: '0956/B09011P',
  imageUrl: '1775608802682814.jpg',
  rarity: 'CP',
};
