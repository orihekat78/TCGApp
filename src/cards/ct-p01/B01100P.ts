// cards/ct-p01/B01100P 怪盗キッドの絡繰箱 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md
//
// B01100 (base) の絵柄違い variant。能力・shape は同一、id / no / imageUrl / rarity のみ override。
import type { CardDef } from '@/engine/types';
import { B01100 } from './B01100.js';

export const B01100P: CardDef = { ...B01100, id: 'B01100P', no: '0088/B01100P', rarity: 'CP', imageUrl: '1714013082082743.jpg' };
