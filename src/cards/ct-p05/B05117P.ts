// cards/ct-p05/B05117P コンコン (イベント パラレル) — B05117 の絵柄違い (同 cardId 0613)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B05117.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B05117 } from './B05117.js';

export const B05117P: CardDef = {
  ...B05117,
  id: 'B05117P',
  no: '0613/B05117P',
  imageUrl: '1747231561675989.jpg',
  rarity: 'CP',
};
