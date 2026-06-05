// cards/ct-p01/B01094P 「刑事なら刑事らしく…」 (イベント) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 28-errata.md
//
// B01094 (base) の絵柄違い variant。能力・shape は同一、id / no / imageUrl / rarity のみ override。
import type { CardDef } from '@/engine/types';
import { B01094 } from './B01094.js';

export const B01094P: CardDef = { ...B01094, id: 'B01094P', no: '0082/B01094P', rarity: 'CP', imageUrl: '1714013082052186.jpg' };
