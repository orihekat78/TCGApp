// cards/ct-p08/B08033 工藤有希子 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/14-refresh.md, rules/16-card-set.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/15-abilities-effects.md
// 公式テキスト:
//   【登場時】自分の現場にいるキャラ1枚につき、自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。\n【パートナー白】【宣言】【ターン2】〚現場にいるキャラに裏向きでセットされているカードを合わせて2枚リムーブする〛：【白】のキャラを1枚まで選び、ターン終了時までAP＋2000し、〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を与える。

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
    kind: 'forEach',
    over: {
      kind: 'all',
      query: {
        area: 'scene',
        side: 'self'
      }
    },
    do: {
      kind: 'atom',
      verb: 'charSetCard',
      args: {
        uid: '$self',
        fromDeckTop: true,
        player: 'self'
      }
    }
  },
  description: '【登場時】自分の現場にいるキャラ1枚につき、自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: [
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/14-refresh.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '白'
  },
  limit: {
    kind: 'turn',
    n: 2
  },
  cost: {
    kind: 'removeSetCard',
    n: 2
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          max: 1,
          side: 'either',
          filter: {
            color: '白'
          },
          delta: 2000,
          scope: 'turn',
          bind: '$picked'
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$picked.uid',
          kw: '突撃[キャラ]',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【パートナー白】【宣言】【ターン2】〚現場にいるキャラに裏向きでセットされているカードを合わせて2枚リムーブする〛：【白】のキャラを1枚まで選び、ターン終了時までAP＋2000し、〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B08033: CardDef = {
  id: 'B08033',
  no: '0872/B08033',
  kind: 'character',
  names: [
    '工藤有希子'
  ],
  colors: [
    '白'
  ],
  level: 8,
  ap: 7000,
  lp: 1,
  traits: [
    '女優'
  ],
  rarity: 'SR',
  imageUrl: '1770731222545956.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md'
  ],
};
