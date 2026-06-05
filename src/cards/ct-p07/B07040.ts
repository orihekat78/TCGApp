// cards/ct-p07/B07040 黒羽千影 (キャラ) — catalog-reuse batch
// rules: 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー白】【宣言】【ターン1】〚特徴［怪盗］〛か〚［マジシャン］〛のキャラを1枚まで選び、
//     ターン終了時まで〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を与えるか、
//     ターン終了時まで〚ブレット〛（このキャラのアクションはガードできない）を与える。
//
// a1: 【パートナー白】(condition partnerColor:白)【宣言】【ターン1】(limit turn:1) コスト無し。
//     効果は choice — [怪盗|マジシャン] のキャラを1枚まで選び 突撃[キャラ](turn) を与えるか、ブレット(turn) を与えるか。
//     各 option は charGrantKeyword $pick + target (D02013 a1 / B01094 $pick+target 同型)。
//     どちらの option も同 query (trait[怪盗|マジシャン]) の pick を保持 (B03074 choice + D02013 pick 結合)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー白】
  condition: { kind: 'partnerColor', color: '白' },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // [怪盗]か[マジシャン]のキャラを1枚まで選び、ターン終了時まで 突撃[キャラ] を与えるか、ブレット を与える
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      // ターン終了時まで〚突撃［キャラ］〛を与える
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$pick',
          kw: '突撃[キャラ]',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'either', filter: { trait: ['怪盗', 'マジシャン'] } },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
      // ターン終了時まで〚ブレット〛を与える
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$pick',
          kw: 'ブレット',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'either', filter: { trait: ['怪盗', 'マジシャン'] } },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description:
    '【パートナー白】【宣言】【ターン1】[怪盗]か[マジシャン]のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛か〚ブレット〛を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/21-declared-ability-cost.md', 'rules/17-icons.md'],
};

export const B07040: CardDef = {
  id: 'B07040',
  no: '0769/B07040',
  kind: 'character',
  names: ['黒羽千影'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762413994262097.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
