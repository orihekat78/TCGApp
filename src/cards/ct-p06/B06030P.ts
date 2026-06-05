// cards/ct-p06/B06030P 松尾芭蕉 (キャラ) — catalog-reuse batch (variant of B06030)
// rules: 03-field-areas.md, 10-action-event.md, 13-keywords.md, 14-refresh.md, 17-icons.md
//
// B06030 と同一カード (cardId 0653) の別 num (パラレル)。base を spread し id/no/imageUrl/rarity を override。

import type { CardDef } from '@/engine/types';
import { B06030 } from './B06030.js';

export const B06030P: CardDef = {
  ...B06030,
  id: 'B06030P',
  no: '0653/B06030P',
  imageUrl: '1755684931910920.jpg',
  rarity: 'CP',
};
