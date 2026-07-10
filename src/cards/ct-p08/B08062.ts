// cards/ct-p08/B08062 佐藤美和子＆高木渉 (character) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md, rules/19-special-rules.md, rules/22-qa-action-contact.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【パートナー黄】【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚カード名［佐藤美和子］〛か〚［高木渉］〛が登場したとき、AP8000以下のキャラを1枚まで選び、リムーブする。\n【自分ターン中】自分の現場にいるすべてのキャラが〚カード名［佐藤美和子］〛か〚［高木渉］〛の場合、自分の現場にいるすべてのキャラをAP＋1000する。この能力はパートナーエリアでも有効になる。
//   【カットイン】AP＋2000

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      payloadKey: 'uid',
      excludeSource: true,
      filter: {
        cardName: [
          '佐藤美和子',
          '高木渉'
        ],
        kind: 'character'
      }
    }
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '黄'
      },
      {
        kind: 'turn',
        player: 'self'
      }
    ]
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      cause: 'effect',
      filter: {
        apMax: 8000
      }
    }
  },
  description: '【パートナー黄】【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚カード名［佐藤美和子］〛か〚［高木渉］〛が登場したとき、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-partner-area',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'turn',
        player: 'self'
      },
      {
        kind: 'not',
        c: {
          kind: 'sceneHas',
          query: {
            area: 'scene',
            side: 'self',
            filter: {
              kind: 'character',
              cardNameNot: [
                '佐藤美和子',
                '高木渉'
              ]
            }
          },
          nMin: 1
        }
      }
    ]
  },
  continuousModifier: {
    apDeltaAura: 1000,
    auraFilter: {
      kind: 'character'
    }
  },
  description: '【自分ターン中】自分の現場にいるすべてのキャラが〚カード名［佐藤美和子］〛か〚［高木渉］〛の場合、自分の現場にいるすべてのキャラをAP＋1000する。この能力はパートナーエリアでも有効になる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/24-qa-naming-stun.md'
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

export const B08062: CardDef = {
  id: 'B08062',
  no: '0899/B08062',
  kind: 'character',
  names: ['佐藤美和子＆高木渉', '佐藤美和子', '高木渉'], // rules/19 複数名カード (BUG-185 一括分割 2026-07-10)
  colors: [
    '黄'
  ],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'MR',
  imageUrl: '1770731238696043.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md'
  ],
};
