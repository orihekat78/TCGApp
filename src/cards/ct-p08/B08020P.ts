// cards/ct-p08/B08020P 遠山和葉 (character SRP、B08020 パラレル — テキスト同一) — engine拡張 wave#2
// rules: rules/05-turn-phases.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
// 公式テキスト・句マッピング・certify 根拠は B08020.ts を参照 (cardId 0860 同一、絵柄/rarity 違いのみ)。

import type { CardDef } from '@/engine/types';
import { B08020 } from './B08020.js';

export const B08020P: CardDef = {
  ...B08020,
  id: 'B08020P',
  no: '0860/B08020P',
  rarity: 'SRP',
  imageUrl: '1770878966413477.jpg',
};
