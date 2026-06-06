// cards/pr-01/PR019 頂いて行くぜ！ (イベント) — event→evidence batch reprint
// B04041 (base) の PR 再録 (別絵柄)。能力 shape 同一、id/no/rarity/imageUrl のみ override。
import type { CardDef } from '@/engine/types';
import { B04041 } from '../ct-p04/B04041.js';

export const PR019: CardDef = { ...B04041, id: 'PR019', no: '0164/PR019', rarity: 'PR', imageUrl: '1714459332032196.jpg' };
