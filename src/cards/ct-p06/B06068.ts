// cards/ct-p06/B06068 京極真 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/07-action-flow.md, rules/08-contact.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）\n【絆鈴木園子】【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、このキャラをアクティブにし、ターン終了時までこのキャラは〚突撃［キャラ］〛を失い、〚突撃［事件］〛を持つ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'bond',
        cardName: '鈴木園子'
      },
      {
        kind: 'removedCharMatches',
        side: 'opp',
        cause: 'contact-ap',
        by: 'self'
      }
    ]
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        },
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$self',
            state: 'active'
          }
        },
        {
          kind: 'atom',
          verb: 'charRevokeKeyword',
          args: {
            uid: '$self',
            kw: '突撃[キャラ]',
            scope: 'turn'
          }
        },
        {
          kind: 'atom',
          verb: 'charGrantKeyword',
          args: {
            uid: '$self',
            kw: '突撃[事件]',
            scope: 'turn'
          }
        }
      ]
    }
  },
  description: '【絆鈴木園子】【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、このキャラをアクティブにし、ターン終了時までこのキャラは〚突撃［キャラ］〛を失い、〚突撃［事件］〛を持つ。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B06068: CardDef = {
  id: 'B06068',
  no: '0689/B06068',
  kind: 'character',
  names: [
    '京極真'
  ],
  colors: [
    '白'
  ],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: [
    '高校生',
    '空手家'
  ],
  rarity: 'R',
  imageUrl: '1754285244507331.jpg',
  keywords: [
    '突撃[キャラ]'
  ],
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ],
};
