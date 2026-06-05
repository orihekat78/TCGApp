// cards/pr-01/PR054 灰原哀 (キャラ) — engine-extension #1 leave:to-remove batch
// rules: 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【登場時】カードを1枚引く。
//   【相手ターン中】【現場リムーブ時】自分は手札を1枚リムーブする。
//
// a1: 【登場時】1 ドロー
// a2: leave:to-remove 自発火 + turn=opp gate で 自分 discard 1

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【登場時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: '【相手ターン中】【現場リムーブ時】自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const PR054: CardDef = {
  id: 'PR054',
  no: '0259/PR054',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['少年探偵団', '科学者'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1936be3841f135.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
