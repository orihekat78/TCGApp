// cards/pr-01/PR033 白鳥任三郎 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【ターン1】相手が【カットイン】か【変装】を使用したとき、コンタクト中のキャラを1枚まで選び、このコンタクト中、AP－1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。\n

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'cutin:used',
    hooks: [
      'disguise:into'
    ],
    matcherCondition: {
      kind: 'triggerPlayerIs',
      side: 'opp'
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    args: {
      delta: -1000,
      inContact: true,
      max: 1,
      scope: 'contact'
    },
    kind: 'atom',
    verb: 'charModifyAP'
  },
  description: '【ターン1】相手が【カットイン】か【変装】を使用したとき、コンタクト中のキャラを1枚まで選び、このコンタクト中、AP－1000する。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const PR033: CardDef = {
  id: 'PR033',
  no: '0256/PR033',
  kind: 'character',
  names: [
    '白鳥任三郎'
  ],
  colors: [
    '黄'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'PR',
  imageUrl: '1721703853401734.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
