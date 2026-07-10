// cards/ct-p06/B06063P せんぷう剣 (イベント パラレル) — B06063 の絵柄違い (同 cardId 0684)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B06063.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B06063 } from './B06063.js';

export const B06063P: CardDef = {
  ...B06063,
  id: 'B06063P',
  no: '0684/B06063P',
  imageUrl: '1755684948614230.jpg',
  rarity: 'CP',
};
