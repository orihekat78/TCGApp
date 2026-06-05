// cards/ct-p05/B05071 アンドレ・キャメル (キャラ) — catalog-reuse batch
// rules: 07-action-flow.md, 10-action-event.md, 03-field-areas.md, 13-keywords.md, 17-icons.md
//
// 公式テキスト:
//   このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: アクション対象拡張 — このキャラが attacker のとき、相手の現場のアクティブも対象可 (D11007 a1 同型)
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // アクションでこのカードが選ばれたとき
  trigger: { hook: 'action:pre-target', selfOnly: true },
  // 相手の現場のアクティブ状態を対象に追加
  effect: { kind: 'atom', verb: 'expandActionTargets', args: { side: 'opp', state: ['active'] } },
  description: 'このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md'],
};

// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 同型 / 明示 pick target 保持)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      // キャラを1枚まで選び、スリープさせる
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } } },
    ],
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B05071: CardDef = {
  id: 'B05071',
  no: '0571/B05071',
  kind: 'character',
  names: ['アンドレ・キャメル'],
  colors: ['赤'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['FBI'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1746628078708364.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
  ],
};
