// cards/pr-01/PR304 松田陣平 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/13-keywords.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   このキャラは相手の現場にいるレベル7以上のアクティブ状態のキャラを指定してアクションできる。\n【パートナー黄】〚突撃〛（名乗り状態でもアクションできる）\n【自分ターン中】【ターン1】このキャラが、このキャラよりAPの高いキャラとコンタクトしたとき、手札を1枚リムーブしてもよい。そうした場合、そのコンタクト中、このキャラをAP＋3000する。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:pre-target',
    selfOnly: true
  },
  effect: {
    args: {
      levelMin: 7,
      side: 'opp',
      state: [
        'active'
      ]
    },
    kind: 'atom',
    verb: 'expandActionTargets'
  },
  description: 'このキャラは相手の現場にいるレベル7以上のアクティブ状態のキャラを指定してアクションできる。',
  ruleRefs: [
    'rules/07-action-flow.md'
  ]
};

const a2 = partnerColorKeyword({
  color: '黄',
  kw: '突撃',
  abilityId: 'a2'
});

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'contact:start',
    matcherCondition: {
      kind: 'contactOpponentApHigher'
    }
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          max: 1
        }
      },
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          uid: '$self',
          delta: 3000,
          scope: 'contact'
        }
      }
    ]
  },
  description: '【自分ターン中】【ターン1】このキャラが、このキャラよりAPの高いキャラとコンタクトしたとき、手札を1枚リムーブしてもよい。そうした場合、そのコンタクト中、このキャラをAP＋3000する。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const PR304: CardDef = {
  id: 'PR304',
  no: '0938/PR304',
  kind: 'character',
  names: [
    '松田陣平'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'PR',
  imageUrl: '1782441097714951.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ],
};
