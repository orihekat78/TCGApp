// cards/ct-p05/B05005 江戸川コナン＆工藤新一 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/09-cutin-disguise.md, rules/12-next-hint.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md, rules/20-color-and-switch.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【パートナー青】【ターン1】自分がネクストヒントで【青】のカードを使用したとき、AP8000以下のキャラを1枚まで選び、デッキの下に移す。\n【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、ターン終了時まで「このキャラはガードできる場合、必ずガードする。」を与える。この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'effect:declared',
    matcherCondition: {
      kind: 'and',
      cs: [
        {
          kind: 'triggerPlayerIs',
          side: 'self'
        },
        {
          kind: 'triggerViaNextHint'
        },
        {
          kind: 'triggerCardMatches',
          filter: {
            color: '青'
          }
        }
      ]
    }
  },
  condition: {
    kind: 'partnerColor',
    color: '青'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'sceneToDeck',
    args: {
      player: 'self',
      side: 'either',
      max: 1,
      pos: 'bottom',
      filter: {
        apMax: 8000
      }
    }
  },
  description: '【パートナー青】【ターン1】自分がネクストヒントで【青】のカードを使用したとき、AP8000以下のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'charSetTurnEffect',
    args: {
      uid: '$pick',
      key: 'mustGuard',
      val: true,
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'opp',
          filter: {
            kind: 'character'
          }
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、ターン終了時まで「このキャラはガードできる場合、必ずガードする。」を与える。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  effect: {
    args: {
      delta: 2000,
      scope: 'contact',
      uid: '$contact.byUid'
    },
    kind: 'atom',
    verb: 'charModifyAP'
  },
  description: '【カットイン】AP＋2000',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B05005: CardDef = {
  id: 'B05005',
  no: '0511/B05005',
  kind: 'character',
  names: [
    '江戸川コナン＆工藤新一'
  ],
  colors: [
    '青'
  ],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: [
    '探偵',
    '毛利探偵事務所',
    '少年探偵団',
    '高校生'
  ],
  rarity: 'MR',
  imageUrl: '1742972384107114.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md'
  ],
};
