// cards/ct-p04/B04010 本堂瑛祐 (キャラ) — engine-extension #1 leave:to-remove batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】レベル4以下のキャラを1枚まで選び、スリープさせる。
//
// a1: leave:to-remove 自発火 + turn=opp gate で level≤4 のキャラを 1 枚まで sleep

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: { player: 'self', max: 1, side: 'either', state: 'sleep', filter: { levelMax: 4 } },
  },
  description: '【相手ターン中】【現場リムーブ時】レベル4以下のキャラを1枚までスリープ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04010: CardDef = {
  id: 'B04010',
  no: '0415/B04010',
  kind: 'character',
  names: ['本堂瑛祐'],
  colors: ['青'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287656249326.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
