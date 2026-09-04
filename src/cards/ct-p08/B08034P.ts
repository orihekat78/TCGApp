// cards/ct-p08/B08034P 工藤優作 (キャラ, パラレル) — B08034 の再録 (set-card 除去, 2026-06-06 タスクC)
// 能力 shape は B08034 と完全同一。id / no / rarity / imageUrl のみ差し替え。

import type { CardDef } from '@/engine/types';
import { B08034 } from './B08034.js';

export const B08034P: CardDef = {
  ...B08034,
  id: 'B08034P',
  no: '0873/B08034P',
  rarity: 'RP',
  imageUrl: '1770878966463233.jpg',
};
