// cards/ct-p01/B01021 吉田歩美 (キャラ・登場時)
// rules: 15-abilities-effects.md, 17-icons.md (§【登場時】/§enter-source), 20-color-and-switch.md
//
// 公式テキスト:
//   【登場時】レベル3以上のキャラの能力やレベル3以上のイベントの効果によって登場した場合、カードを1枚引く。
//
// engine拡張 wave#2 cluster11 (2026-06-15, BUG-146 coupled): enter-source gate は B01014/B01015 と同一。

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
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【登場時】レベル3以上のキャラ能力/レベル3以上のイベント効果で登場した場合、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B01021: CardDef = {
  id: 'B01021',
  no: '0017/B01021',
  kind: 'character',
  names: ['吉田歩美'],
  colors: ['青'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714012985532421.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
