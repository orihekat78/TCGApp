// cards/ct-p05/B05087 諸伏高明 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/05-turn-phases.md
// 公式テキスト:
//   【パートナー黄】【自分ターン中】【ターン1】自分のリムーブエリアにある〚特徴［長野県警］〛のキャラがリムーブエリアから離れたとき、AP7000以下のキャラを1枚まで選び、リムーブする。\n自分のターン終了時、自分のリムーブエリアにあるレベル6以下の〚特徴［長野県警］〛のキャラを1枚まで選び、手札に加える。カードを手札に加え、自分の手札が6枚以上ある場合、手札を1枚リムーブする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'remove:exit',
    matcherCondition: {
      kind: 'removeExitMatches',
      side: 'self',
      removeFilter: {
        trait: '長野県警',
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
        apMax: 7000
      }
    }
  },
  description: '【パートナー黄】【自分ターン中】【ターン1】自分のリムーブエリアにある〚特徴［長野県警］〛のキャラがリムーブエリアから離れたとき、AP7000以下のキャラを1枚まで選び、リムーブする。',
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
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'handAddFromRemove',
        args: {
          player: 'self',
          max: 1,
          filter: {
            trait: '長野県警',
            levelMax: 6,
            kind: 'character'
          }
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'handAtLeast',
          player: 'self',
          n: 6
        },
        then: {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        }
      }
    ]
  },
  description: '自分のターン終了時、自分のリムーブエリアにあるレベル6以下の〚特徴［長野県警］〛のキャラを1枚まで選び、手札に加える。カードを手札に加え、自分の手札が6枚以上ある場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B05087: CardDef = {
  id: 'B05087',
  no: '0585/B05087',
  kind: 'character',
  names: [
    '諸伏高明'
  ],
  colors: [
    '黄'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '警察',
    '長野県警'
  ],
  rarity: 'SR',
  imageUrl: '1743742488539411.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/05-turn-phases.md'
  ],
};
