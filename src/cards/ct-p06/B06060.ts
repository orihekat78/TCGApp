// cards/ct-p06/B06060 龍神 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】〚リムーブエリアに移す〛：〚特徴［YAIBA］〛のキャラを1枚まで選び、アクティブにするか、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//
// a1: 宣言能力 — コスト〚リムーブエリアに移す〛(対象省略 = このキャラ自身 rules/21) で
//     removeFromScene{ target:self, n:1 } (B03055 / B09083 同型)。
//     効果は choice — [YAIBA を1枚までアクティブ (sceneSetState active)] か
//     [YAIBA を1枚までターン終了まで〚突撃〛付与 (charGrantKeyword)] ($pick + 明示 target / D02013 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 〚リムーブエリアに移す〛: 対象省略 → このキャラ自身を現場からリムーブエリアへ (rules/21 対象省略解釈)
  cost: { kind: 'removeFromScene', target: { kind: 'self' }, n: 1 },
  // 〚特徴［YAIBA］〛のキャラを1枚まで選び、アクティブにするか、ターン終了時まで〚突撃〛を与える。
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      // [YAIBA]のキャラを1枚まで選び、アクティブにする
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'active', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { trait: 'YAIBA' } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
      // [YAIBA]のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$pick', kw: '突撃', scope: 'turn', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { trait: 'YAIBA' } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
    ],
  },
  description: '【宣言】〚リムーブエリアに移す〛：[YAIBA]を1枚まで選び、アクティブにするかターン終了時まで〚突撃〛を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B06060: CardDef = {
  id: 'B06060',
  no: '0681/B06060',
  kind: 'character',
  names: ['龍神'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285220525107.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/21-declared-ability-cost.md',
  ],
};
