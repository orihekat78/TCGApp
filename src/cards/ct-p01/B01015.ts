// cards/ct-p01/B01015 円谷光彦 (キャラ・登場時)
// rules: 15-abilities-effects.md, 17-icons.md (§【登場時】/§enter-source), 20-color-and-switch.md
//
// 公式テキスト:
//   【登場時】レベル3以上のキャラの能力やレベル3以上のイベントの効果によって登場した場合、
//   キャラを1枚まで選び、ターン終了時までAP＋2000する。
//
// engine拡張 wave#2 cluster11 (2026-06-15, BUG-146 coupled): enter-source gate は B01014 と同一
// (or([{character,levelMin:3},{event,levelMin:3}]))。対象は無条件「キャラ」= filter 無し (B01014 の levelMax:5 を継承しない)。

import type { AbilityDef, CardDef } from '@/engine/types';

const enterByLv3 = {
  kind: 'or' as const,
  cs: [
    { kind: 'enterSource' as const, viaEffect: true, sourceFilter: { kind: 'character' as const, levelMin: 3 } },
    { kind: 'enterSource' as const, viaEffect: true, sourceFilter: { kind: 'event' as const, levelMin: 3 } },
  ],
};

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  condition: enterByLv3,
  // キャラを1枚まで選び、ターン終了時まで AP+2000 (PA短縮形 = side:'either' / 「1枚まで」= max:1 で 0 可)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, max: 1, side: 'either', scope: 'turn' } },
  description: '【登場時】レベル3以上のキャラ能力/レベル3以上のイベント効果で登場した場合、キャラを1枚までターン終了まで AP＋2000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B01015: CardDef = {
  id: 'B01015',
  no: '0011/B01015',
  kind: 'character',
  names: ['円谷光彦'],
  colors: ['青'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714012985509852.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
