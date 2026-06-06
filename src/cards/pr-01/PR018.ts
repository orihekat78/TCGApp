// cards/pr-01/PR018 そーいう事かいな… (イベント) — event→evidence batch reprint
// B04028 (base) の PR 再録 (別絵柄)。能力 shape 同一、id/no/rarity/imageUrl のみ override。
import type { CardDef } from '@/engine/types';
import { B04028 } from '../ct-p04/B04028.js';

export const PR018: CardDef = { ...B04028, id: 'PR018', no: '0163/PR018', rarity: 'PR', imageUrl: '1714459332028827.jpg' };
