// cards/ct-p09/B09107P 犯人たちの犯行 (事件 パラレル) — B09107 の絵柄違い (同 cardId 1046)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B09107.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B09107 } from './B09107.js';

export const B09107P: CardDef = {
  ...B09107,
  id: 'B09107P',
  no: '1046/B09107P',
  imageUrl: '1775608944016936.jpg',
  rarity: 'CP',
};
