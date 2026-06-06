// cards/pr-01/PR013 そーいう事かいな… (イベント) — event→evidence batch reprint
// B04028 (base) の PR 再録。能力 shape 同一、id/no/rarity/imageUrl のみ override。
import type { CardDef } from '@/engine/types';
import { B04028 } from '../ct-p04/B04028.js';

export const PR013: CardDef = { ...B04028, id: 'PR013', no: '0163/PR013', rarity: 'PR', imageUrl: '1714459332009771.jpg' };
