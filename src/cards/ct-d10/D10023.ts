// cards/ct-d10/D10023 毛利蘭 (キャラ) — B02004 の再録 (multi-hook 共有【ターン1】, 2026-06-06 タスクC)
// 能力 shape は B02004 と完全同一 (rules/19 と同じ multi-hook + 絆 + enter-from-remove + leave-hook)。
// id / no / imageUrl のみ差し替え (event→evidence PR 再録と同パターン)。

import type { CardDef } from '@/engine/types';
import { B02004 } from '../ct-p02/B02004.js';

export const D10023: CardDef = {
  ...B02004,
  id: 'D10023',
  no: '0176/D10023',
  imageUrl: '1761913181950402.jpg',
};
