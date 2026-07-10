// cards/ct-p06/B06062P かみなり斬り (イベント パラレル) — B06062 の絵柄違い (同 cardId 0683)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B06062.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B06062 } from './B06062.js';

export const B06062P: CardDef = {
  ...B06062,
  id: 'B06062P',
  no: '0683/B06062P',
  imageUrl: '1755684948609241.jpg',
  rarity: 'CP',
};
