// cards/ct-p01/B01099P どっちの推理ショー (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md
//
// B01099 (base) の絵柄違い variant。能力・shape は同一、id / no / imageUrl / rarity のみ override。
import type { CardDef } from '@/engine/types';
import { B01099 } from './B01099.js';

export const B01099P: CardDef = { ...B01099, id: 'B01099P', no: '0087/B01099P', rarity: 'CP', imageUrl: '1714013082077429.jpg' };
