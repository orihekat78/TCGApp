// cards/ct-p01/B01014 小嶋元太 (キャラ・登場時)
// rules: 15-abilities-effects.md, 17-icons.md (§【登場時】/§enter-source), 20-color-and-switch.md
//
// 公式テキスト:
//   【登場時】レベル3以上のキャラの能力やレベル3以上のイベントの効果によって登場した場合、
//   レベル5以下のキャラを1枚まで選び、スリープさせる。
//
// engine拡張 wave#2 cluster11 (2026-06-15, BUG-146 coupled):
//   - enter-source gate = or([{character,levelMin:3},{event,levelMin:3}])。「レベル3以上」は原文で
//     キャラ・イベント の両方の前に反復されるため両 disjunct に levelMin:3 を付与 (certify 確認)。
//   - viaEffect:true = 手札使用/ネクストヒント (viaEffect:false) を除外 (rules/20)。
//   - 効果 = sceneSetState PA短縮形 (side:'either' 固定 / 「1枚まで」= max:1 で 0 可、rules/15)。

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
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】(rules/17: 能力/効果による登場でも発動)
  condition: enterByLv3,
  // レベル5以下のキャラを1枚まで選び、スリープさせる
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', state: 'sleep', max: 1, filter: { levelMax: 5 } } },
  description: '【登場時】レベル3以上のキャラ能力/レベル3以上のイベント効果で登場した場合、レベル5以下のキャラを1枚までスリープ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B01014: CardDef = {
  id: 'B01014',
  no: '0010/B01014',
  kind: 'character',
  names: ['小嶋元太'],
  colors: ['青'],
  level: 4,
  ap: 5000,
  lp: 0,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714012985507627.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
