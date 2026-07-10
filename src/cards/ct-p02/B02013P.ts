// cards/ct-p02/B02013P ターボエンジン付きスケートボード (イベント パラレル) — B02013 の絵柄違い (同 cardId 0185)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B02013.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B02013 } from './B02013.js';

export const B02013P: CardDef = {
  ...B02013,
  id: 'B02013P',
  no: '0185/B02013P',
  imageUrl: '1721357158868518.jpg',
  rarity: 'CP',
};
