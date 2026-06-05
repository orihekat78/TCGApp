// cards/pr-01/PR241 メアリー (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// PR235 の絵柄違い (同 cardId 0933)。base を spread で再利用。

import type { CardDef } from '@/engine/types';
import { PR235 } from './PR235.js';

export const PR241: CardDef = { ...PR235, id: 'PR241', no: '0933/PR241', imageUrl: '1769159371862468.jpg' };
