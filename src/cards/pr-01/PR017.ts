// cards/pr-01/PR017 ……なるほどな… (イベント) — event→evidence batch reprint
// B04015 (base) の PR 再録 (別絵柄)。能力 shape 同一、id/no/rarity/imageUrl のみ override。
import type { CardDef } from '@/engine/types';
import { B04015 } from '../ct-p04/B04015.js';

export const PR017: CardDef = { ...B04015, id: 'PR017', no: '0162/PR017', rarity: 'PR', imageUrl: '1714459332024588.jpg' };
