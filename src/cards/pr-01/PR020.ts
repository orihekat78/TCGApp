// cards/pr-01/PR020 なるほど… (イベント) — event→evidence batch reprint
// B04062 (base) の PR 再録 (別絵柄)。能力 shape 同一、id/no/rarity/imageUrl のみ override。
import type { CardDef } from '@/engine/types';
import { B04062 } from '../ct-p04/B04062.js';

export const PR020: CardDef = { ...B04062, id: 'PR020', no: '0165/PR020', rarity: 'PR', imageUrl: '1714459332036403.jpg' };
