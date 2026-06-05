// cards/ct-p08/B08083 ラム (キャラ) — engine#1 leave:to-remove batch #3 (a1 only)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】カードを1枚引く。
//   【事件青＆黒】【宣言】【スリープ】：手札から【現場リムーブ時】を持つレベル5以下のキャラを1枚まで登場させる。
//
// a1: 【相手ターン中】【現場リムーブ時】カードを1枚引く (D03013 a1 同型)
// a2: DEFERRED (declared 事件青&黒 + sleep cost + sceneEnter from hand with hook filter)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【相手ターン中】【現場リムーブ時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B08083: CardDef = {
  id: 'B08083',
  no: '0919/B08083',
  kind: 'character',
  names: ['ラム'],
  colors: ['黒'],
  level: 6, ap: 5000, lp: 1,
  traits: ['黒ずくめの組織'], keywords: [],
  rarity: 'R',
  imageUrl: '1770731255833292.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
