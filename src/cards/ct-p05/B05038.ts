// cards/ct-p05/B05038 魔犬 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【相手ターン中】AP＋2000
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: 【相手ターン中】= continuous (condition turn:opp) + apDelta+2000 (D08005 a1 同型の continuous 修正)
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 同型 inline)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【相手ターン中】
  condition: { kind: 'turn', player: 'opp' },
  // AP＋2000 (read 時に再計算: engine.read.char.ap が走査)
  continuousModifier: { apDelta: 2000 },
  description: '【相手ターン中】AP＋2000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // キャラを1枚まで選び、スリープさせる
  // 注: hirameki fire は明示 target ($pick + pick query) を保持する (D08019 a2 同型)。
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

export const B05038: CardDef = {
  id: 'B05038',
  no: '0542/B05038',
  kind: 'character',
  names: ['魔犬'],
  colors: ['緑'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['犬'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1746628061757173.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
