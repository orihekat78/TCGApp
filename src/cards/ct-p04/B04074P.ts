// cards/ct-p04/B04074P 降谷零 (character・パラレル) — engine mega-wave W5 exemplar (r47 levelInBound, 2026-07-03)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md,
//        25-qa-effects-resolution.md
//
// 公式テキスト (B04074 と同一)。句マッピング = B04074.ts 参照 (chain[conditional{bond 風見裕也 →
// souza4/souza2, bind '$found'}, sceneRemove levelInBound])。P 版差分は rarity / imageUrl のみ。
// ⚠ chain 必須 (sequence 不可): step2 PA 短縮形が dispatch 時に bindings['$found'] を読む。

import type { AbilityDef, CardDef } from '@/engine/types';
import { B04074 } from './B04074.js';

const a1: AbilityDef = { ...B04074.abilities[0]! };

export const B04074P: CardDef = {
  ...B04074,
  id: 'B04074P',
  no: '0460/B04074P',
  rarity: 'RP',
  imageUrl: '1735287822621020.jpg',
  abilities: [a1],
};
