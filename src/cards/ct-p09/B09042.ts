// cards/ct-p09/B09042 江戸川文代 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】：自分の現場にいる〚カード名［闇の男爵］〛を1枚まで選び、ターン終了時まで〚突撃〛（名乗り状態でもアクションできる）を与える。
//   【ヒラメキ】自分のリムーブエリアにある〚カード名［闇の男爵］〛を1枚まで選び、手札に加える。
//
// a1: 【宣言】【スリープ】cost → 現場の[闇の男爵]を1枚まで選び、ターン終了時まで〚突撃〛付与
//     (charGrantKeyword $pick + target pick / B02061 a1 step2 同型)。
// a2: 【ヒラメキ】リムーブの[闇の男爵]を1枚まで選び、手札に加える (handAddFromRemove / B09088 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' }, // 【スリープ】(もともと sleep / stun なら canPay=false で宣言不可)
  // 自分の現場にいる[闇の男爵]を1枚まで選び、ターン終了時まで〚突撃〛を与える (候補 0 件 / user skip OK)
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$pick', kw: '突撃', scope: 'turn',
          target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '闇の男爵' } }, n: { min: 0, max: 1 }, chooser: 'self' },
        },
      },
    ],
  },
  description: '【宣言】【スリープ】：自分の現場の[闇の男爵]を1枚まで選び、ターン終了時まで〚突撃〛を与える。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/13-keywords.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // 自分のリムーブエリアにある[闇の男爵]を1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '闇の男爵' } } },
  description: '【ヒラメキ】自分のリムーブエリアにある[闇の男爵]を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/19-special-rules.md'],
};

export const B09042: CardDef = {
  id: 'B09042',
  no: '0985/B09042',
  kind: 'character',
  names: ['江戸川文代'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['女優'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608856110976.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
