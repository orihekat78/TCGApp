// cards/ct-p02/B02002 江戸川コナン (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【登場時】自分の現場にレベル7以上の【青】以外の色を持つキャラがいる場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。\n【ターン1】このキャラがアクションしたとき、自分の現場にいる【青】以外の色を持つキャラ1枚につき、アクション終了時までこのキャラをAP＋1000する。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'sceneHas',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          levelMin: 7,
          colorNot: '青'
        }
      },
      nMin: 1
    },
    then: {
      kind: 'atom',
      verb: 'charGrantKeyword',
      args: {
        uid: '$self',
        kw: '突撃',
        scope: 'turn'
      }
    }
  },
  description: '【登場時】自分の現場にレベル7以上の【青】以外の色を持つキャラがいる場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    selfOnly: true
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$self',
      delta: {
        dyn: '$self.sceneColorNot.青 * 1000'
      },
      scope: 'action'
    }
  },
  description: '【ターン1】このキャラがアクションしたとき、自分の現場にいる【青】以外の色を持つキャラ1枚につき、アクション終了時までこのキャラをAP＋1000する。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B02002: CardDef = {
  id: 'B02002',
  no: '0174/B02002',
  kind: 'character',
  names: [
    '江戸川コナン'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 5000,
  lp: 2,
  traits: [
    '探偵',
    '毛利探偵事務所',
    '少年探偵団'
  ],
  rarity: 'SR',
  imageUrl: '1721357158812078.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
