// cards/ct-p03/B03013 大尉 (キャラ) — engine-extension #1 leave:to-remove batch
// rules: 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】キャラを1枚まで選び、ターン終了時までAP－2000する。
//
// a1: leave:to-remove 自発火 + turn=opp gate で AP-2000 turn-scope

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: { delta: -2000, max: 1, side: 'either', scope: 'turn' },
  },
  description: '【相手ターン中】【現場リムーブ時】キャラを1枚まで選び、ターン終了時までAP-2000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B03013: CardDef = {
  id: 'B03013',
  no: '0271/B03013',
  kind: 'character',
  names: ['大尉'],
  colors: ['青'],
  level: 2,
  ap: 2000,
  lp: 0,
  traits: ['猫'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133048310031.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
