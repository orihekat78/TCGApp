// cards/ct-p05/B05056 鈴木次郎吉 (キャラ) — engine#1 leave:to-remove batch #3 (a1 only)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】カードを1枚引く。
//   【宣言】【スリープ】：手札からレベル6以下の〚特徴［鈴木財閥］〛のキャラを1枚まで登場させる。
//
// a1: 【相手ターン中】【現場リムーブ時】カードを1枚引く (D03013 a1 同型)
// a2: DEFERRED (declared sleep cost + sceneEnter from hand with trait filter)

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

export const B05056: CardDef = {
  id: 'B05056',
  no: '0558/B05056',
  kind: 'character',
  names: ['鈴木次郎吉'],
  colors: ['白'],
  level: 7, ap: 5000, lp: 1,
  traits: ['鈴木財閥'], keywords: [],
  rarity: 'C',
  imageUrl: '1745322205544322.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
