// cards/pr-01/PR281 江戸川コナン (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【パートナー青】【登場時】手札から〚特徴［少年探偵団］〛のキャラを1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。\n自分のターン終了時、自分の現場に〚特徴［少年探偵団］〛のキャラが3枚以上いる場合、カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  condition: {
    color: '青',
    kind: 'partnerColor'
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        args: {
          filter: {
            kind: 'character',
            trait: '少年探偵団'
          },
          max: 1,
          player: 'self'
        },
        kind: 'atom',
        verb: 'discard'
      },
      {
        args: {
          filter: {
            apMax: 8000
          },
          max: 1,
          player: 'self',
          side: 'either'
        },
        kind: 'atom',
        verb: 'sceneRemove'
      }
    ]
  },
  description: '【パートナー青】【登場時】手札から〚特徴［少年探偵団］〛のキャラを1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  effect: {
    if: {
      kind: 'sceneHas',
      nMin: 3,
      query: {
        area: 'scene',
        filter: {
          trait: '少年探偵団'
        },
        side: 'self'
      }
    },
    kind: 'conditional',
    then: {
      args: {
        n: 1,
        player: 'self'
      },
      kind: 'atom',
      verb: 'draw'
    }
  },
  description: '自分のターン終了時、自分の現場に〚特徴［少年探偵団］〛のキャラが3枚以上いる場合、カードを1枚引く。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/17-icons.md'
  ]
};

export const PR281: CardDef = {
  id: 'PR281',
  no: '0489/PR281',
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
  rarity: 'PR',
  imageUrl: '1779885194344973.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
