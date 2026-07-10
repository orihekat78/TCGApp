// cards/ct-p06/B06104P カッ (イベント パラレル) — B06104 の絵柄違い (同 cardId 0721)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B06104.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B06104 } from './B06104.js';

export const B06104P: CardDef = {
  ...B06104,
  id: 'B06104P',
  no: '0721/B06104P',
  imageUrl: '1755684985596527.jpg',
  rarity: 'CP',
};
