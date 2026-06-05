// cards/ct-d03/D03013 鈴木次郎吉 (キャラ) — engine-extension #1 leave:to-remove batch
// rules: 10-action-event.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: leave:to-remove 自発火 (engine-extension #1) + turn=opp gate で 1 ドロー
// a2: 【ヒラメキ】キャラを1枚までスリープ (D11009 a3 同型 inline)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【相手ターン中】【現場リムーブ時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
    ],
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const D03013: CardDef = {
  id: 'D03013',
  no: '0129/D03013',
  kind: 'character',
  names: ['鈴木次郎吉'],
  colors: ['白'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['鈴木財閥'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013132364703.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
