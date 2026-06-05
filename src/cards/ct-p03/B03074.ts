// cards/ct-p03/B03074 沖矢昴 (キャラ) — catalog-reuse batch
// rules: 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン2】〚手札からカード名［赤井秀一］かカード名［ライ］を1枚リムーブする〛：ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つか、ターン終了時までこのキャラは〚ブレット〛（このキャラのアクションはガードできない）を持つ。
//
// a1: 宣言能力 — 【ターン2】cost removeFromHand{pick: cardName[赤井秀一|ライ] hand}。
//     効果は choice — 突撃(turn) を与えるか、ブレット(turn) を与えるか (D11015 a2 grant + choice 列挙)。
//     どちらも uid:'$self' / scope:'turn' (D08005 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 2 }, // 【ターン2】
  // 〚手札からカード名[赤井秀一]かカード名[ライ]を1枚リムーブする〛
  cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: ['赤井秀一', 'ライ'] } }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  // ターン終了時までこのキャラは〚突撃〛を持つか、ターン終了時までこのキャラは〚ブレット〛を持つ
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      // 突撃を与える
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
      // ブレットを与える
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: 'ブレット', scope: 'turn' } },
    ],
  },
  description: '【宣言】【ターン2】〚手札から[赤井秀一]か[ライ]を1枚リムーブ〛：ターン終了時までこのキャラは〚突撃〛か〚ブレット〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B03074: CardDef = {
  id: 'B03074',
  no: '0328/B03074',
  kind: 'character',
  names: ['沖矢昴'],
  colors: ['赤'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['大学院生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133424863145.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
