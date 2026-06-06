// cards/ct-p03/B03006P 結成 少年探偵団 (キャラ) — exact-reprint batch (2026-06-06 タスクA)
// variant spread of D08021 (絵柄違い / rarity RP)。公式テキスト byte 一致のため abilities 完全流用。
import type { CardDef } from '@/engine/types';
import { D08021 } from '../ct-d08/D08021.js';

export const B03006P: CardDef = {
  ...D08021,
  id: 'B03006P',
  no: '0264/B03006P',
  rarity: 'RP',
  imageUrl: '1729133048266813.jpg',
};
