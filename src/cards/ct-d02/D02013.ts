// cards/ct-d02/D02013 服部静華 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】〚手札を1枚リムーブする〛：このキャラ以外のレベル6以下の【緑】のキャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。この能力は相手の現場にスリープ状態かスタン状態のキャラが合わせて2枚以上いる場合に宣言できる。
//
// a1: declared【ターン1】 cost=手札1枚リム / condition=相手現場の sleep|stun が2枚以上 /
//     effect= このキャラ以外のレベル6以下【緑】を1枚まで選び 突撃 を ターン終了まで付与 (D08005 a2 charGrantKeyword + D08019 a2 $pick+target 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // この能力は相手の現場にスリープ状態かスタン状態のキャラが合わせて2枚以上いる場合に宣言できる
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'opp', state: ['sleep', 'stun'] }, nMin: 2 },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 〚手札を1枚リムーブする〛
  cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  // このキャラ以外のレベル6以下の【緑】のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$pick',
          kw: '突撃',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'either', filter: { color: '緑', levelMax: 6 }, excludeSelf: true },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description:
    '【宣言】【ターン1】〚手札を1枚リムーブ〛: このキャラ以外のレベル6以下【緑】を1枚までターン終了まで〚突撃〛付与。相手現場の sleep|stun が2枚以上で宣言可。',
  ruleRefs: ['rules/13-keywords.md', 'rules/21-declared-ability-cost.md', 'rules/17-icons.md'],
};

export const D02013: CardDef = {
  id: 'D02013',
  no: '0115/D02013',
  kind: 'character',
  names: ['服部静華'],
  colors: ['緑'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013117384306.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
