// cards/ct-p03/B03028P 服部平次 (キャラ パラレル) — B03028 の絵柄違い (同 cardId 0285)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03028.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03028 } from './B03028.js';

export const B03028P: CardDef = {
  ...B03028,
  id: 'B03028P',
  no: '0285/B03028P',
  imageUrl: '1729133201313095.jpg',
  rarity: 'SRP',
};
