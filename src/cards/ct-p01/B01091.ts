// cards/ct-p01/B01091 高木渉 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【絆佐藤美和子】【自分ターン中】AP+3000
//   [ヒラメキ欄] 【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: 【絆佐藤美和子】【自分ターン中】= continuous (condition and(bond, turn:self)) apDelta +3000
//     (常時有効型: read 時に再計算 / 条件外で即失効。D08005 a1 同型の continuousModifier)。
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 と同型 — $pick + 明示 target)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【絆佐藤美和子】【自分ターン中】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'bond', cardName: '佐藤美和子' },
      { kind: 'turn', player: 'self' },
    ],
  },
  // AP+3000
  continuousModifier: { apDelta: 3000 },
  description: '【絆佐藤美和子】【自分ターン中】AP+3000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】任意発動 (fire/skip)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // キャラを1枚まで選び、スリープさせる
  // 注: hiremeki fire 時に auto-pick されるよう明示 target ($pick + pick query) を保持 (D08019 a2 同型)。
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

export const B01091: CardDef = {
  id: 'B01091',
  no: '0079/B01091',
  kind: 'character',
  names: ['高木渉'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013067554857.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
