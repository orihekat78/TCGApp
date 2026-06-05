// cards/ct-p09/B09006P 毛利小五郎 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 0951 の variant (絵柄違い RP)。base B09006 を spread。
import type { CardDef } from '@/engine/types';
import { B09006 } from '../ct-p09/B09006.js';

export const B09006P: CardDef = { ...B09006, id: 'B09006P', no: '0951/B09006P', rarity: 'RP', imageUrl: '1775608802615155.jpg' };
