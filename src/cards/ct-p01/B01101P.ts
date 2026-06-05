// cards/ct-p01/B01101P 赤と黒のクラッシュ (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md
//
// B01101 (base) の絵柄違い variant。能力・shape は同一、id / no / imageUrl / rarity のみ override。
import type { CardDef } from '@/engine/types';
import { B01101 } from './B01101.js';

export const B01101P: CardDef = { ...B01101, id: 'B01101P', no: '0089/B01101P', rarity: 'CP', imageUrl: '1714013082088104.jpg' };
