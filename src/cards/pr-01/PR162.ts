// cards/pr-01/PR162 「もう少し引き付けろ…」 (イベント) — catalog-reuse batch
// rules: 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// PR156 の絵柄違い (同 cardId 0625)。base を spread で再利用。

import type { CardDef } from '@/engine/types';
import { PR156 } from './PR156.js';

export const PR162: CardDef = { ...PR156, id: 'PR162', no: '0625/PR162', imageUrl: '1753704129555312.jpg' };
