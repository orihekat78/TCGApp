// cards/ct-p03/B03015 津川秀治 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 09-cutin-disguise.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【カットイン】AP5000以下のキャラを1枚まで選び、スリープさせる。（コンタクト中に手札からリムーブして使う）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）AP5000以下のキャラを1枚まで選び、スリープさせる。
//
// a1: 【カットイン】AP5000以下のキャラを1枚まで選びスリープ (effect:declared on-hand + sceneSetState pick)
// a2: 【ヒラメキ】AP5000以下のキャラを1枚まで選びスリープ (D08019 a2 同型 — fire 時 auto-pick のため explicit pick target を保持)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  // AP5000以下のキャラを1枚まで選び、スリープさせる
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { apMax: 5000 } }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
    ],
  },
  description: '【カットイン】AP5000以下のキャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // 【ヒラメキ】AP5000以下のキャラを1枚まで選び、スリープさせる
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { apMax: 5000 } }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
    ],
  },
  description: '【ヒラメキ】AP5000以下のキャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B03015: CardDef = {
  id: 'B03015',
  no: '0273/B03015',
  kind: 'character',
  names: ['津川秀治'],
  colors: ['青'],
  level: 6,
  ap: 5000,
  lp: 0,
  traits: ['図書館館長'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133136440186.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
