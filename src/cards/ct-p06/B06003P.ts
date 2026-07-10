// cards/ct-p06/B06003P 毛利蘭＆江戸川コナン (キャラ パラレル) — B06003 の絵柄違い (同 cardId 0628)
// TSV 全列同文 (rarity MRCP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B06003.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B06003 } from './B06003.js';

export const B06003P: CardDef = {
  ...B06003,
  id: 'B06003P',
  no: '0628/B06003P',
  imageUrl: '1755762456845193.jpg',
  rarity: 'MRCP',
};
