// cards/ct-p06/B06016P 鬼丸猛 (character, parallel) — deck-mill-gated-chain wave (2026-06-23)
// 公式テキストは B06016 と語義一致 (base TSV は【登場時⁆ の括弧 typo、P は【登場時】で正、効果同一)。
// 同一 AbilityDef を継承し no/rarity/imageUrl のみ差し替え。
import type { CardDef } from '@/engine/types';
import { B06016 } from './B06016.js';

export const B06016P: CardDef = { ...B06016, id: 'B06016P', no: '0639/B06016P', rarity: 'SRCP', imageUrl: '1755762456853532.jpg' };
