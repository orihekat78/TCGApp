// cards/ct-p01/B01044P 怪盗キッド (character, parallel) — deck-mill-gated-chain wave (2026-06-23)
// 公式テキストは B01044 と完全一致 (md5 IDENTICAL)。同一 AbilityDef を継承し no/rarity/imageUrl のみ差し替え。
import type { CardDef } from '@/engine/types';
import { B01044 } from './B01044.js';

export const B01044P: CardDef = { ...B01044, id: 'B01044P', no: '0036/B01044P', rarity: 'SRP', imageUrl: '1714013020308784.jpg' };
