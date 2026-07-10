// cards/ct-p04/B04089P ベルモット (キャラ パラレル) — B04089 の絵柄違い (同 cardId 0471)
// TSV 全列同文 (rarity RP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B04089.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B04089 } from './B04089.js';

export const B04089P: CardDef = {
  ...B04089,
  id: 'B04089P',
  no: '0471/B04089P',
  imageUrl: '1735287841304158.jpg',
  rarity: 'RP',
};
