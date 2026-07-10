// cards/ct-p02/B02018 服部平次 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【自分ターン中】【ターン2】このキャラにカード1枚がセットされるたび、このキャラをアクティブにするか、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。\n【宣言】【ターン1】〚デッキのカードを上から3枚リムーブする〛：自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'setcard:enter',
    selfOnly: true
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  limit: {
    kind: 'turn',
    n: 2
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
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
        verb: 'charGrantKeyword',
        args: {
          uid: '$self',
          kw: '突撃',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【自分ターン中】【ターン2】このキャラにカード1枚がセットされるたび、このキャラをアクティブにするか、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'removeDeckTop',
    player: 'self',
    n: 3
  },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: {
      uid: '$self',
      fromDeckTop: true,
      faceUp: false,
      player: 'self'
    }
  },
  description: '【宣言】【ターン1】〚デッキのカードを上から3枚リムーブする〛：自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B02018: CardDef = {
  id: 'B02018',
  no: '0188/B02018',
  kind: 'character',
  names: [
    '服部平次'
  ],
  colors: [
    '緑'
  ],
  level: 8,
  ap: 8000,
  lp: 1,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'SR',
  imageUrl: '1721357188612017.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
