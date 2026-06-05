// cards/ct-p04/B04070 高木渉 (キャラ・突撃+宣言) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー黄】〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）
//   【絆高木渉】【宣言】【ターン1】〚現場にいるカード名［佐藤美和子］を1枚スリープさせ、手札を1枚リムーブする〛：このキャラをアクティブにする。
//
// a1: 【パートナー黄】〚突撃［キャラ］〛 — partnerColorKeyword 共通 (D11007 a2 同型 partnerColor continuous)
// a2: 【絆佐藤美和子】【宣言】【ターン1】複合コスト(現場[佐藤美和子]1枚スリープ + 手札1枚リム) → このキャラをアクティブにする
//     (cost pay で sleepChar + removeFromHand を複合: B04008 a1 同型 / effect sceneSetState active $self: B01028 a3 同型)
// 注: 公式テキストの絆対象は[佐藤美和子] (タイトルは高木渉だが絆条件カード名は佐藤美和子)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

// a1: 【パートナー黄】〚突撃［キャラ］〛
const a1: AbilityDef = partnerColorKeyword({ color: '黄', kw: '突撃[キャラ]', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【絆佐藤美和子】
  condition: { kind: 'bond', cardName: '佐藤美和子' },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 〚現場にいるカード名［佐藤美和子］を1枚スリープさせ、手札を1枚リムーブする〛 (pay で複合コスト)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepChar', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '佐藤美和子' } }, n: { min: 1, max: 1 }, chooser: 'self' } },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    ],
  },
  // このキャラをアクティブにする
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
  description: '【絆佐藤美和子】【宣言】【ターン1】〚現場の[佐藤美和子]を1枚スリープ + 手札1枚リム〛: このキャラをアクティブにする。',
  ruleRefs: ['rules/13-keywords.md', 'rules/21-declared-ability-cost.md', 'rules/17-icons.md'],
};

export const B04070: CardDef = {
  id: 'B04070',
  no: '0456/B04070',
  kind: 'character',
  names: ['高木渉'],
  colors: ['黄'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1735287822589481.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
