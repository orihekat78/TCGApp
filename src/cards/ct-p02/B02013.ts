// cards/ct-p02/B02013 ターボエンジン付きスケートボード (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/16-card-set.md, rules/13-keywords.md, rules/17-icons.md
// 公式テキスト:
//   このイベントを自分の現場にいるレベル7以下の【青】のキャラ1枚にセットする。\nこのイベントがセットされているキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: {
      player: 'self',
      fromSelf: true,
      n: 1,
      filter: {
        color: '青',
        levelMax: 7,
        kind: 'character'
      }
    }
  },
  description: 'このイベントを自分の現場にいるレベル7以下の【青】のキャラ1枚にセットする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-set-host',
  continuousModifier: {
    grantKeywords: () => ['突撃']
  },
  description: 'このイベントがセットされているキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/16-card-set.md',
    'rules/17-icons.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    args: {
      fromSelf: true,
      player: 'self'
    },
    kind: 'atom',
    verb: 'handAddFromRemove'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B02013: CardDef = {
  id: 'B02013',
  no: '0185/B02013',
  kind: 'event',
  names: [
    'ターボエンジン付きスケートボード'
  ],
  colors: [
    '青'
  ],
  level: 4,
  traits: [],
  rarity: 'C',
  imageUrl: '1721357158865909.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/13-keywords.md',
    'rules/17-icons.md'
  ],
};
