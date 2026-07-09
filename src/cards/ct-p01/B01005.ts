// cards/ct-p01/B01005 江戸川コナン (character) — Task A green候補 (engine変更0)
// rules: rules/12-next-hint.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/23-qa-disguise-cutin.md
// 公式テキスト:
//   【パートナー青】【ターン1】自分がネクストヒントで手札を使用したとき、そのカードのレベル以下のレベルのキャラを1枚まで選び、デッキの下に移す。

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
        levelMax: {
          dyn: '$trigger.cardLevel'
        }
      }
    }
  },
  description: '【パートナー青】【ターン1】自分がネクストヒントで手札を使用したとき、そのカードのレベル以下のレベルのキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md'
  ]
};

export const B01005: CardDef = {
  id: 'B01005',
  no: '0001/B01005',
  kind: 'character',
  names: [
    '江戸川コナン'
  ],
  colors: [
    '青'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '探偵',
    '毛利探偵事務所',
    '少年探偵団'
  ],
  rarity: 'SR',
  imageUrl: '1734349765552707.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md'
  ],
};
