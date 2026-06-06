// cards/pr-01/PR012 ……なるほどな… (イベント) — event→evidence batch reprint
// B04015 (base) の PR 再録。能力 shape 同一、id/no/rarity/imageUrl のみ override。
import type { CardDef } from '@/engine/types';
import { B04015 } from '../ct-p04/B04015.js';

export const PR012: CardDef = { ...B04015, id: 'PR012', no: '0162/PR012', rarity: 'PR', imageUrl: '1714459332004710.jpg' };
