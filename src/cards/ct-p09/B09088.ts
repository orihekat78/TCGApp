// cards/ct-p09/B09088 横溝参悟 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】【青】か【黄】のキャラを1枚まで選び、ターン終了時までAP＋1000する。
//   【ヒラメキ】自分のリムーブエリアにある〚カード名［横溝重悟］〛か〚［毛利小五郎］〛を1枚まで選び、手札に加える。
//
// a1: 宣言能力【ターン1】 charModifyAP 短縮形 pick (color 青/黄 OR, side:either, AP+1000 turn) — D11012 a1 同型
// a2: 【ヒラメキ】 handAddFromRemove (cardName 横溝重悟/毛利小五郎 OR) — D11012 a2 同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 【青】か【黄】のキャラを1枚まで選び、ターン終了時までAP＋1000する。
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, max: 1, side: 'either', filter: { color: ['青', '黄'] }, scope: 'turn' } },
  description: '【宣言】【ターン1】【青】か【黄】のキャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // 【ヒラメキ】自分のリムーブエリアにある〚カード名［横溝重悟］〛か〚［毛利小五郎］〛を1枚まで選び、手札に加える。
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: ['横溝重悟', '毛利小五郎'] } } },
  description: '【ヒラメキ】リムーブの[横溝重悟]か[毛利小五郎]を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/19-special-rules.md'],
};

export const B09088: CardDef = {
  id: 'B09088',
  no: '1028/B09088',
  kind: 'character',
  names: ['横溝参悟'],
  colors: ['黄'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['警察', '静岡県警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608926328499.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
