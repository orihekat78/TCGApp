// cards/pr-01/PR173 毛利蘭 (キャラ) — B02004 の PR 再録 (multi-hook 共有【ターン1】, 2026-06-06 タスクC)
// 能力 shape は B02004 と完全同一。id / no / rarity / imageUrl のみ差し替え。

import type { CardDef } from '@/engine/types';
import { B02004 } from '../ct-p02/B02004.js';

export const PR173: CardDef = {
  ...B02004,
  id: 'PR173',
  no: '0176/PR173',
  rarity: 'PR',
  imageUrl: '198dc69b29c23.jpg',
};
