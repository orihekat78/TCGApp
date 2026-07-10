// cards/ct-p03/B03112P ライ (キャラ パラレル) — B03112 の絵柄違い (同 cardId 0361)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03112.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03112 } from './B03112.js';

export const B03112P: CardDef = {
  ...B03112,
  id: 'B03112P',
  no: '0361/B03112P',
  imageUrl: '1729133482972877.jpg',
  rarity: 'SRP',
};
