// cards/ct-p01/B01027 遠山和葉 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー緑】LP＋1
//   【宣言】【スリープ】：〚カード名［服部平次］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//
// a1: continuous【パートナー緑】 — このキャラを LP＋1 (partnerColor cond + lpDelta、D08005 a1 同型)。
// a2: declared【スリープ】 — 自身を sleep コストに、カード名[服部平次] を1枚までターン終了まで〚突撃〛付与 (D02013 a1 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【パートナー緑】
  condition: { kind: 'partnerColor', color: '緑' },
  // LP＋1 (このキャラ自身、read 時に合算)
  continuousModifier: { lpDelta: 1 },
  description: '【パートナー緑】LP＋1',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】 = 自身をスリープさせるコスト
  cost: { kind: 'sleepSelf' },
  // 〚カード名［服部平次］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える
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
            query: { area: 'scene', side: 'either', filter: { cardName: '服部平次' } },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description:
    '【宣言】【スリープ】: 〚カード名［服部平次］〛のキャラを1枚までターン終了時まで〚突撃〛付与。',
  ruleRefs: ['rules/13-keywords.md', 'rules/21-declared-ability-cost.md'],
};

export const B01027: CardDef = {
  id: 'B01027',
  no: '0021/B01027',
  kind: 'character',
  names: ['遠山和葉'],
  colors: ['緑'],
  level: 7,
  ap: 5000,
  lp: 0,
  traits: ['高校生'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1714013000979715.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
