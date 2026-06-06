// cards/pr-01/PR016 拳銃か！！ (イベント) — event→evidence batch reprint
// B04086 (base) の PR 再録。能力 shape 同一、id/no/rarity/imageUrl のみ override。
import type { CardDef } from '@/engine/types';
import { B04086 } from '../ct-p04/B04086.js';

export const PR016: CardDef = { ...B04086, id: 'PR016', no: '0166/PR016', rarity: 'PR', imageUrl: '1714459332021950.jpg' };
