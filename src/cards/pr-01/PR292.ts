// cards/pr-01/PR292 キャンティ (character) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【宣言】【スリープ】〚デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによって【カットイン】を持つ【黒】のカードが3枚以上リムーブされた場合、相手の現場にいるレベル7以下のキャラを1枚まで選び、リムーブする。
//   【カットイン】【自分ターン中】キャラを1枚まで選び、スリープさせる。（自分のターンのコンタクト中に手札からリムーブして使う）

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepSelf'
      },
      {
        kind: 'removeDeckTop',
        player: 'self',
        n: 3
      }
    ]
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'costRemovedMatches',
      filter: {
        keyword: 'カットイン',
        color: '黒'
      },
      n: 3
    },
    then: {
      kind: 'atom',
      verb: 'sceneRemove',
      args: {
        player: 'self',
        max: 1,
        side: 'opp',
        filter: {
          levelMax: 7
        }
      }
    }
  },
  description: '【宣言】【スリープ】〚デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによって【カットイン】を持つ【黒】のカードが3枚以上リムーブされた場合、相手の現場にいるレベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  condition: {
    kind: 'turn',
    player: 'self'
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
  description: '【カットイン】【自分ターン中】キャラを1枚まで選び、スリープさせる。（自分のターンのコンタクト中に手札からリムーブして使う）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const PR292: CardDef = {
  id: 'PR292',
  no: '1063/PR292',
  kind: 'character',
  names: [
    'キャンティ'
  ],
  colors: [
    '黒'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'PR',
  imageUrl: '1779885194423472.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md'
  ],
};
