// cards/ct-p09/B09016 円谷光彦 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/17-icons.md, rules/03-field-areas.md, rules/11-reasoning.md, rules/15-abilities-effects.md
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）\n【相手ターン中】【ターン1】このキャラが〚ミスリード〛したとき、自分の現場に〚カード名［円谷光彦］〛以外のレベル4の〚特徴［少年探偵団］〛のキャラがいる場合、このキャラをアクティブにする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'icon-misread',
  scope: 'on-scene',
  effect: {
    args: {
      kind: 'misread-marker',
      x: 1
    },
    kind: 'atom',
    verb: 'noop'
  },
  description: '〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）',
  ruleRefs: [
    'rules/13-keywords.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'misread:performed',
    selfOnly: true
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'turn',
        player: 'opp'
      },
      {
        kind: 'sceneHas',
        query: {
          area: 'scene',
          side: 'self',
          filter: {
            cardNameNot: '円谷光彦',
            levelMin: 4,
            levelMax: 4,
            trait: '少年探偵団'
          }
        },
        nMin: 1
      }
    ]
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$self',
      state: 'active'
    }
  },
  description: '【相手ターン中】【ターン1】このキャラが〚ミスリード〛したとき、自分の現場に〚カード名［円谷光彦］〛以外のレベル4の〚特徴［少年探偵団］〛のキャラがいる場合、このキャラをアクティブにする。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ]
};

export const B09016: CardDef = {
  id: 'B09016',
  no: '0961/B09016',
  kind: 'character',
  names: [
    '円谷光彦'
  ],
  colors: [
    '青'
  ],
  level: 4,
  ap: 3000,
  lp: 0,
  traits: [
    '少年探偵団'
  ],
  rarity: 'C',
  imageUrl: '1775608818995429.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md'
  ],
};
