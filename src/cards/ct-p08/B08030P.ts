// cards/ct-p08/B08030P 執事になった理由 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 0870 の variant (絵柄違い CP)。base B08030 を spread。
import type { CardDef } from '@/engine/types';
import { B08030 } from '../ct-p08/B08030.js';

export const B08030P: CardDef = { ...B08030, id: 'B08030P', no: '0870/B08030P', rarity: 'CP', imageUrl: '1770878966445217.jpg' };
