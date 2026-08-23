// cards/ct-p08/B08083 ラム (キャラ)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】カードを1枚引く。
//   【事件青＆黒】【宣言】【スリープ】：手札から【現場リムーブ時】を持つレベル5以下のキャラを1枚まで登場させる。
//
// a1: 【相手ターン中】【現場リムーブ時】カードを1枚引く (D03013 a1 同型)
// a2: 事件青&黒 + sleep cost + printed leave-trigger presence filter.

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

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene',
  condition: { kind: 'caseColor', color: ['青', '黒'], combine: 'and' },
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'atom', verb: 'sceneEnter',
    args: {
      player: 'self', from: 'hand', max: 1, viaEffect: true,
      filter: { kind: 'character', keyword: '現場リムーブ時', levelMax: 5 },
    },
  },
  description: '【事件青＆黒】【宣言】【スリープ】：手札から【現場リムーブ時】を持つレベル5以下のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
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
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};
