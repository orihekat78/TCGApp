// cards/ct-p03/B03003P 灰原哀 (キャラ パラレル) — B03003 の絵柄違い (同 cardId 0261)
// TSV 全列同文 (rarity SRCP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B03003.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B03003 } from './B03003.js';

export const B03003P: CardDef = {
  ...B03003,
  id: 'B03003P',
  no: '0261/B03003P',
  imageUrl: '193519f3400311.jpg',
  rarity: 'SRCP',
};
