// cards/ct-p07/B07054P 「アイスクリームは……甘いんだぜ!!」 (イベント パラレル) — B07054 の絵柄違い (同 cardId 0783)
// TSV 全列同文 (rarity CP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B07054.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B07054 } from './B07054.js';

export const B07054P: CardDef = {
  ...B07054,
  id: 'B07054P',
  no: '0783/B07054P',
  imageUrl: '1763546809950052.jpg',
  rarity: 'CP',
};
