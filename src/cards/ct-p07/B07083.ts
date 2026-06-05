// cards/ct-p07/B07083 三池苗子 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【事件編】【登場時】カードを1枚引く。
//   【宣言】〚デッキの下に移す〛：〚特徴［警視庁］〛のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を与える。
//
// a1: 【事件編】【登場時】draw 1 (enter hook + caseStatus 事件編 condition)。
// a2: 【宣言】〚デッキの下に移す〛 cost で [警視庁] を1枚まで選び ターン終了まで 突撃[キャラ] 付与
//     (D02013 a1 charGrantKeyword $pick+target / D11012 a1 selfToDeckBottom cost 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件編】
  condition: { kind: 'caseStatus', status: '事件編' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // カードを1枚引く。
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【事件編】【登場時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 〚デッキの下に移す〛
  cost: { kind: 'selfToDeckBottom' },
  // 〚特徴［警視庁］〛のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$pick',
          kw: '突撃[キャラ]',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'either', filter: { trait: '警視庁' } },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description:
    '【宣言】〚デッキの下に移す〛: [警視庁]のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/21-declared-ability-cost.md', 'rules/17-icons.md'],
};

export const B07083: CardDef = {
  id: 'B07083',
  no: '0811/B07083',
  kind: 'character',
  names: ['三池苗子'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1762414027367614.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
