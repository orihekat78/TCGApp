// cards/ct-p05/B05023P 「探偵の毛利小五郎でございます…」 (イベント パラレル) — B05023 の絵柄違い (同 cardId 0529)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B05023.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B05023 } from './B05023.js';

export const B05023P: CardDef = {
  ...B05023,
  id: 'B05023P',
  no: '0529/B05023P',
  imageUrl: '1747231489449989.jpg',
  rarity: 'CP',
};
