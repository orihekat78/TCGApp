// cards/pr-01/PR288 萩原研二 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/15-abilities-effects.md, rules/01-victory-conditions.md, rules/22-qa-action-contact.md, rules/13-keywords.md, rules/10-action-event.md
// 公式テキスト:
//   〚突撃〛（名乗り状態でもアクションできる）\nこのキャラがアクションしたとき、自分の裏向きの証拠を1つ選び、表向きにし、相手の裏向きの証拠を1つ選び、表向きにする。（選べる場合、必ず選んで表向きにする）合わせて2つ表向きにした場合、ターン終了時までこのキャラをAP＋1000する。
//   【ヒラメキ】相手の裏向きの証拠を1つまで選び、表向きにする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'evidenceFlip',
        args: {
          player: 'self',
          cardIds: '$pick.cardIds',
          n: 1,
          faceDown: true,
          bind: '$flipSelf'
        }
      },
      {
        kind: 'atom',
        verb: 'evidenceFlip',
        args: {
          player: 'opp',
          cardIds: '$pick.cardIds',
          n: 1,
          faceDown: true,
          bind: '$flipOpp'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'and',
          cs: [
            {
              kind: 'bound',
              key: '$flipSelf',
              presence: 'matched'
            },
            {
              kind: 'bound',
              key: '$flipOpp',
              presence: 'matched'
            }
          ]
        },
        then: {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            uid: '$self',
            delta: 1000,
            scope: 'turn'
          }
        }
      }
    ]
  },
  description: 'このキャラがアクションしたとき、自分の裏向きの証拠を1つ選び、表向きにし、相手の裏向きの証拠を1つ選び、表向きにする。（選べる場合、必ず選んで表向きにする）合わせて2つ表向きにした場合、ターン終了時までこのキャラをAP＋1000する。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/01-victory-conditions.md',
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
      faceDown: true,
      max: 1,
      player: 'opp'
    },
    kind: 'atom',
    verb: 'evidenceFlip'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）相手の裏向きの証拠を1つまで選び、表向きにする。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/10-action-event.md'
  ]
};

export const PR288: CardDef = {
  id: 'PR288',
  no: '0705/PR288',
  kind: 'character',
  names: [
    '萩原研二'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'PR',
  imageUrl: '1779885194396059.jpg',
  keywords: [
    '突撃'
  ],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/01-victory-conditions.md',
    'rules/22-qa-action-contact.md',
    'rules/13-keywords.md',
    'rules/10-action-event.md'
  ],
};
