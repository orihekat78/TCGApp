// cards/ct-p05/B05027 服部平次＆遠山和葉 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【パートナー緑】【宣言】【ターン1】レベル8以下の【緑】のキャラを1枚まで選び、アクティブにするか、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。\n【ターン1】自分の現場に〚カード名［服部平次］〛か〚［遠山和葉］〛が登場したとき、キャラを1枚まで選び、スリープさせる。この能力はパートナーエリアでも発動する。
//   【カットイン】AP＋2000

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '緑'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          uid: '$pick',
          state: 'active',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'either',
              filter: {
                levelMax: 8,
                color: '緑'
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
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$pick',
          kw: '突撃',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'either',
              filter: {
                levelMax: 8,
                color: '緑'
              }
            },
            n: {
              min: 0,
              max: 1
            },
            chooser: 'self'
          }
        }
      }
    ]
  },
  description: '【パートナー緑】【宣言】【ターン1】レベル8以下の【緑】のキャラを1枚まで選び、アクティブにするか、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-partner-area',
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      payloadKey: 'uid',
      filter: {
        cardName: [
          '服部平次',
          '遠山和葉'
        ]
      }
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      state: 'sleep'
    }
  },
  description: '【ターン1】自分の現場に〚カード名［服部平次］〛か〚［遠山和葉］〛が登場したとき、キャラを1枚まで選び、スリープさせる。この能力はパートナーエリアでも発動する。',
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

export const B05027: CardDef = {
  id: 'B05027',
  no: '0531/B05027',
  kind: 'character',
  names: ['服部平次＆遠山和葉', '服部平次', '遠山和葉'], // rules/19 複数名カード (BUG-185 一括分割 2026-07-10)
  colors: [
    '緑'
  ],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'MR',
  imageUrl: '1743754511109231.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
