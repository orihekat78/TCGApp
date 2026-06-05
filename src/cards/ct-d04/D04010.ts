// cards/ct-d04/D04010 ジョディ・スターリング (キャラ) — engine-extension #1 leave:to-remove batch
// rules: 10-action-event.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】相手は手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: leave:to-remove 自発火 + turn=opp gate で 相手 discard 1
// a2: 【ヒラメキ】キャラを1枚までスリープ (D11009 a3 同型 inline)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  effect: { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } },
  description: '【相手ターン中】【現場リムーブ時】相手は手札を1枚リムーブする。',
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

export const D04010: CardDef = {
  id: 'D04010',
  no: '0141/D04010',
  kind: 'character',
  names: ['ジョディ・スターリング'],
  colors: ['赤'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['FBI'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013132402737.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
