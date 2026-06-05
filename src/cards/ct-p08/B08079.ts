// cards/ct-p08/B08079 ピンガ (キャラ) — engine#1 leave batch #3 + continuous AP (a1 + a2)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【自分ターン中】AP＋1000
//   【相手ターン中】【現場リムーブ時】カードを1枚引き、手札を1枚リムーブする。
//   【宣言】【スリープ】：AP8000以下のキャラを1枚まで選び、リムーブする。
//     この能力は自分の事件が【黒】以外の色を持つ場合に宣言できる。
//
// a1: 【自分ターン中】continuous self AP+1000 (D08005 同型)
// a2: 【相手ターン中】【現場リムーブ時】draw 1 → discard 1 chain (B06080 a1 同型)
// a3: DEFERRED (declared sleep cost + sceneRemove + custom condition: 事件 not 黒)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDelta: 1000 },
  description: '【自分ターン中】AP＋1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
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

export const B08079: CardDef = {
  id: 'B08079',
  no: '0915/B08079',
  kind: 'character',
  names: ['ピンガ'],
  colors: ['黒'],
  level: 8, ap: 7000, lp: 1,
  traits: ['黒ずくめの組織'], keywords: [],
  rarity: 'SR',
  imageUrl: '1770731255806019.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
