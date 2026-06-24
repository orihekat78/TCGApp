// cards/ct-p08/B08039 鈴木綾子 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【事件編】【登場時】手札から〚特徴［鈴木財閥］〛のキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: triggered (enter) — 【事件編】で gate / 手札から[鈴木財閥]を1枚までリム(してもよい)→ そうした場合カードを2枚引く
//     (chain: step1 discard 鈴木財閥 max:1 → step2 draw 2。no-candidate/decline で break — B04056 a1 同型)
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 inline $pick + sceneSetState 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件編】
  condition: { kind: 'caseStatus', status: '事件編' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札から[鈴木財閥]のキャラを1枚リムーブしてもよい (max:1 で skip 可能、skip 時は chain break)
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '鈴木財閥' } } },
      // そうした場合、カードを2枚引く (step1 実効果あり時のみ)
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    ],
  },
  description: '【事件編】【登場時】手札から[鈴木財閥]を1枚リムーブしてもよい。そうした場合カードを2枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】(証拠からリムーブされるときに発動する) — 任意発動
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // キャラを1枚まで選び、スリープさせる
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

export const B08039: CardDef = {
  id: 'B08039',
  no: '0878/B08039',
  kind: 'character',
  names: ['鈴木綾子'],
  colors: ['白'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['大学院生', '鈴木財閥'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731222586872.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
