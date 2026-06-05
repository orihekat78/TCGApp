// cards/ct-p08/B08084 ウォッカ (キャラ) — engine-extension #1 leave:to-remove batch
// rules: 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】カードを1枚引き、手札を1枚リムーブする。
//
// a1: leave:to-remove 自発火 + turn=opp gate で 1 ドロー → discard 1 chain (B06009 a1 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw',    args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【相手ターン中】【現場リムーブ時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B08084: CardDef = {
  id: 'B08084',
  no: '0920/B08084',
  kind: 'character',
  names: ['ウォッカ'],
  colors: ['黒'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731255840630.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
