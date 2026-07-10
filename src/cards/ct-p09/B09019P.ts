// cards/ct-p09/B09019P 「くさるなよ！」 (イベント パラレル) — B09019 の絵柄違い (同 cardId 0964)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B09019.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B09019 } from './B09019.js';

export const B09019P: CardDef = {
  ...B09019,
  id: 'B09019P',
  no: '0964/B09019P',
  imageUrl: '1775608819030116.jpg',
  rarity: 'CP',
};
