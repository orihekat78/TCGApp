// cards/ct-p06/B06080 世良真純 (キャラ) — engine#1 leave:to-remove batch #3 (a1 only)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】カードを1枚引き、手札を1枚リムーブする。
//   【宣言】【ターン1】レベル7以下のキャラを1枚まで選び、リムーブする。
//     この能力はこのキャラがスリープ状態かスタン状態の場合に宣言できる。
//
// a1: 【相手ターン中】【現場リムーブ時】draw 1 → discard 1 chain (B06009 a1 同型)
// a2: DEFERRED (declared + custom condition: 自身が sleep または stun)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
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

export const B06080: CardDef = {
  id: 'B06080',
  no: '0700/B06080',
  kind: 'character',
  names: ['世良真純'],
  colors: ['赤'],
  level: 7, ap: 6000, lp: 1,
  traits: ['探偵', '高校生', '赤井家'], keywords: [],
  rarity: 'C',
  imageUrl: '1754285244568183.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
