// cards/ct-p03/B03094P 萩原千速 (character, parallel) — deck-mill-gated-chain wave (2026-06-23)
// 公式テキストは B03094 と完全一致 (md5 IDENTICAL)。同一 AbilityDef を継承し no/rarity/imageUrl のみ差し替え。
import type { CardDef } from '@/engine/types';
import { B03094 } from './B03094.js';

export const B03094P: CardDef = { ...B03094, id: 'B03094P', no: '0347/B03094P', rarity: 'CP', imageUrl: '1729133463264457.jpg' };
