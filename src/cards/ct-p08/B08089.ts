// cards/ct-p08/B08089 ヘルエンジェル (キャラ) — engine-extension #1 leave:to-remove batch
// rules: 10-action-event.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】カードを1枚引く。自分の事件が解決編の場合、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: leave:to-remove 自発火 + turn=opp gate で 1 ドロー → (caseStatus:解決編 なら) discard 1
// a2: 【ヒラメキ】キャラを1枚までスリープ (D11009 a3 同型 inline)

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
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      {
        kind: 'conditional',
        if: { kind: 'caseStatus', status: '解決編' },
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description: '【相手ターン中】【現場リムーブ時】カードを1枚引く。事件が解決編なら手札を1枚リムーブ。',
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

export const B08089: CardDef = {
  id: 'B08089',
  no: '0925/B08089',
  kind: 'character',
  names: ['ヘルエンジェル'],
  colors: ['黒'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731270500727.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
