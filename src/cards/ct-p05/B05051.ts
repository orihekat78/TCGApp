// cards/ct-p05/B05051 京極真 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/24-qa-naming-stun.md, rules/17-icons.md, rules/05-turn-phases.md, rules/14-refresh.md
// 公式テキスト:
//   〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）\nこのキャラは事件を指定してアクションできない。\n【絆鈴木園子】自分のターン終了時、カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: {
    caseActionBan: true
  },
  description: 'このキャラは事件を指定してアクションできない。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/24-qa-naming-stun.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'bond',
        cardName: '鈴木園子'
      },
      {
        kind: 'turn',
        player: 'self'
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【絆鈴木園子】自分のターン終了時、カードを1枚引く。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/14-refresh.md'
  ]
};

export const B05051: CardDef = {
  id: 'B05051',
  no: '0553/B05051',
  kind: 'character',
  names: [
    '京極真'
  ],
  colors: [
    '白'
  ],
  level: 8,
  ap: 8000,
  lp: 0,
  traits: [
    '高校生',
    '空手家'
  ],
  rarity: 'C',
  imageUrl: '1745322205516215.jpg',
  keywords: [
    '突撃[キャラ]'
  ],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/24-qa-naming-stun.md',
    'rules/17-icons.md',
    'rules/05-turn-phases.md',
    'rules/14-refresh.md'
  ],
};
