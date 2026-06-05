// cards/ct-p09/B09025 綾小路文麿 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン2】手札から〚カード名［マロちゃん］〛を1枚まで登場させる。
//
// a1: 宣言能力【ターン2】 手札から[マロちゃん]を1枚まで登場 (sceneEnter from:'hand' cardName filter / B05055 a1 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 2 }, // 【ターン2】各ターン2回まで使用可
  // 手札から[マロちゃん]のキャラを1枚まで登場させる (候補 0 件 / user skip OK)
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self', cardId: '$pick.cardId', from: 'hand', viaEffect: true,
          target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: 'マロちゃん' } }, n: { min: 0, max: 1 }, chooser: 'self' },
        },
      },
    ],
  },
  description: '【宣言】【ターン2】手札から[マロちゃん]を1枚まで登場させる。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

export const B09025: CardDef = {
  id: 'B09025',
  no: '0969/B09025',
  kind: 'character',
  names: ['綾小路文麿'],
  colors: ['緑'],
  level: 8,
  ap: 8000,
  lp: 1,
  traits: ['警察', '京都府警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608819115457.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
