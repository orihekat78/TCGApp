// cards/ct-p01/B01102P 牧場に墜ちた火種 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md
//
// B01102 (base) の絵柄違い variant。能力・shape は同一、id / no / imageUrl / rarity のみ override。
import type { CardDef } from '@/engine/types';
import { B01102 } from './B01102.js';

export const B01102P: CardDef = { ...B01102, id: 'B01102P', no: '0090/B01102P', rarity: 'CP', imageUrl: '1714013082093108.jpg' };
