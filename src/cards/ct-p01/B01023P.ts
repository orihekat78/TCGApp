// cards/ct-p01/B01023P シャッフルロマンス (イベント パラレル) — B01023 の絵柄違い (同 cardId 0019)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B01023.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B01023 } from './B01023.js';

export const B01023P: CardDef = {
  ...B01023,
  id: 'B01023P',
  no: '0019/B01023P',
  imageUrl: '1714012985541569.jpg',
  rarity: 'CP',
};
